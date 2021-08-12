<template>

  <p style="white-space: pre-line">Click a node, relation or shape to show all attributes<br>
  ctrl+click a relation to add the node to the graph<br>
  shift+mousewheel / shift+pan to zoom or pan<br></p>

  <label for="adecay">Enter graph convergence speed, between 0 and 1</label>
  <input type="number" v-model="alpha_decay_rate" placeholder="0.023" name="adecay"><br>

  <label for="width">Enter prefered graph width: </label>
  <input type="number" v-model="graph_width" placeholder="400" name="width"><br>

  <label for="height">Enter prefered graph height: </label>
  <input type="number" v-model="graph_height" placeholder="400" name="height"><br>

  <label for="url">Enter URL: </label>
  <input type="url" v-model="data_url" placeholder="URL" name="url"><br>

  <button v-on:click="getData(undefined)">Draw Graph</button><br>

  <p>All members conform to shape: {{shape_validation}}</p>

  <label for="checkbox_shape">Show shape validation report</label>
  <input type="checkbox" id="checkbox_shape" v-model="checked_shape">

  <div v-if="checked_shape">
    <div v-if="shape_report">
      <div style="white-space: pre-line">{{shape_report}}</div>
    </div>
    <div v-else>
      <p>No report available.</p>
    </div>
  </div>

  <div id="my_dataviz" style="overflow:scroll"></div>

  <div v-if="svgHolder">
    <p>Click a node to reload after changing this option.</p>
    <select v-model="selected">
      <option value="1">Node</option>
      <option value="2">Members</option>
    </select>
  </div>

  <div id="extra"></div>

  <p>{{jsondata}}</p>

</template>


<script>

import rdfDereferencer from "rdf-dereference";
import 'setimmediate';
import * as d3 from "d3";
const extractMetadata = require('@treecg/tree-metadata-extraction').extractMetadata
import * as N3 from 'n3';
import rdfSerializer from "rdf-serialize";
const streamifyArray = require('streamify-array');
const stringifyStream = require('stream-to-string');

const factory = require('rdf-ext');
const ParserN3 = require('@rdfjs/parser-n3');
const SHACLValidator = require('rdf-validate-shacl');


const { DataFactory } = N3;
const { namedNode, defaultGraph } = DataFactory;


export default {
  name: 'App',
  components: {
  },
  data(){
    return {
      qtext: [],
      //easier to clear jsondata in functions without having to copy paste this
      empty : {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[], "relations_holder":[]},
      jsondata: null, //this will be set to empty on start of getData
      members: {},
      svgHolder: null,
      remarks: "",
      next_url: "",
      checked_shape: false,
      graph_height: 600,
      graph_width: 1000,
      data_url: null,
      shape_validation: "unknown",
      shape_report: null,
      selected: "1",
      alpha_decay_rate: 0.5//1 - Math.pow(0.001, 1 / 300)
    }
  },
  methods : {
    async extractId(store, id) {
      const quadsWithSubj = store.getQuads(id, null, null, null);
      const textStream = rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
      return await stringifyStream(textStream);
    },

    async extractShapeId(store, id){
      const quadsWithSubj =  this.extractShapeHelp(store, id);
      const textStream = rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
      return await stringifyStream(textStream);
    },

    extractShapeHelp(store, id, checked = []) {
      var quadsWithSubj = store.getQuads(id, null, null, null);
      for (let quad of quadsWithSubj){
        if (quad.object.termType === "NamedNode" || quad.object.termType === "BlankNode") {
          if (quad.object.id && !checked.includes(quad.object.id)){
            checked.push(quad.object.id);
            quadsWithSubj = quadsWithSubj.concat(this.extractShapeHelp(store, quad.object.id, checked));
          }
        }
      }
      return quadsWithSubj;
    },

    async extractShape(store, id){
      console.log("quads: ", store.getQuads(id, null, null, null));
      var quadsWithSubj = this.extractShapeHelp(store, id);

      const store2 = new N3.Store();
      store2.addQuads(quadsWithSubj);
      var targetQuads = [];
      //TODO add a check for implicit targetting, when shacl shape is both a class and sh:NodeShape then the identifier is a class and thus is the target
      const shapeTargets = ['targetClass', 'targetNode', 'targetSubjectsOf', 'targetObjectsOf']
      for (let tempTarget of shapeTargets){
        targetQuads = targetQuads.concat(store2.getQuads(null, 'http://www.w3.org/ns/shacl#'+tempTarget, null, null))
      }

      // If no target was given for the shape, make it target all tree:member objects
      if (targetQuads.length == 0){
        store2.addQuad(
          namedNode(id),
          namedNode('http://www.w3.org/ns/shacl#targetObjectsOf'),
          namedNode('https://w3id.org/tree#member'),
          defaultGraph()
        );

        quadsWithSubj = this.extractShapeHelp(store2, id);
      }

      return rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
    },

    extractShapeMembers(store, ids){
      var quadsWithSubj = [];
      for (let id of ids){
        quadsWithSubj = quadsWithSubj.concat(store.getQuads(id, null, null, null));
        // We need quads with a member as object for shacl targetting
        quadsWithSubj = quadsWithSubj.concat(store.getQuads(null, null, id, null));
      }
      return rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
    },

    async getData(url) {
      //TODO is it possible to keep all quads, extract all metadata and then not have to check for doubles?
      //Simply by removing all doubles from the saved quads?

      //Need to clear the data before redrawing
      this.qtext = [];
      this.remarks = "";

      //var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/a.nt';
      var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/.root.nt'
      standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/stops_a2.nt';
      standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/cht_1_2.ttl';
      // standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/marine1.jsonld'

      if(url){
        standardURL = url;
      } else if (this.data_url){
        standardURL = this.data_url;
        // This means user gave a url for a new collection so we need to clear whatever data we already had
        this.jsondata = this.empty;
        d3.select("#extra").selectAll("g").remove();
        this.svgHolder = null;
      } else {
        //Fallback
        this.jsondata = this.empty;
        d3.select("#extra").selectAll("g").remove();
        this.svgHolder = null;
      }

      const {quads} = await rdfDereferencer.dereference(standardURL);
      quads.on('data', (quad) => {this.qtext.push(quad); /*console.log(quad)*/})
      .on('error', (error) => console.error(error))
      .on('end', () => {
        console.log('All done!');
        // quads is an array of RDF Quads (RDF.Quad[])
        extractMetadata(this.qtext).then(metadata => {
          console.log(metadata);

          const store = new N3.Store(this.qtext)

          if (metadata.collections.size > 1){
            let errorText = "";
            errorText += "ERROR: found multiple collections! This is not allowed.\n";
            errorText += JSON.stringify(metadata.collections, null, '/t');
            errorText += "\ncheck tree:view, hydra:view, void:subset, dct:isPartOf, as:partOf.";
            errorText += "\nOther causes: \nmembers/shape are linked not to the collection but the node.";
            errorText += "\ncheck tree:member, hydra:member, as:items, ldp:contains.";
            alert(errorText);
          }

          if (metadata.collections.size == 0){

            if (this.jsondata.collection.length == 0){
              alert("No collection pre-defined and no collection found on " + standardURL + ".\nPlease provide a different starting URL.");
              return;
            }

            if (!this.jsondata[standardURL+"_node"]){
              this.jsondata[standardURL+"_node"] = [];

              alert("no collection metadata found at " + standardURL + ".\nWill add an empty node for this URL.");
              this.jsondata.nodes.push({"id":standardURL+"_node", "type":"Node", "name":standardURL, "relation_count":0, "offsetX": this.jsondata.nodes.length});
              this.jsondata.relations_holder.push({"id":standardURL+"_node", "node_id":standardURL+"_node", "name":standardURL, "relation_count":0, "offsetX": this.jsondata.relations_holder.length})
              this.jsondata.links.push({"source":this.jsondata.collection[0].id, "target":standardURL+"_node", "name":"relation_holder"});
            }
          }

          for (var collectionId of metadata.collections.keys()) {
            this.members[standardURL] = [];
            var collectionObj = metadata.collections.get(collectionId);

            let double = true;
            if (this.jsondata.collection.length > 0){
              for (let checker of this.jsondata.collection){
                if (checker.id != collectionId){
                  double = false;
                }
              }
            }

            if (!double){
              let errorText = "";
              errorText += "ERROR: new node is linked to a different collection! This is not allowed.";
              errorText += '\n' + "current URL: " + standardURL;
              errorText += '\n' + "new collection: " + collectionId;
              errorText += '\n' + "original collection: " + this.jsondata.collection[0].id;
              alert(errorText);
              return;
            }

            if (this.jsondata.collection.length == 0){

              let collection = {};
              collection.id = collectionId;
              collection.name = collectionObj['@id'];
              collection.type = "collection";
              collection.vocab = collectionObj['@context']["@vocab"];

              let possibleAttrs = ["import", "importStream", "conditionalImport", "totalItems"];
              for (let pAttr of possibleAttrs){
                if (collectionObj[pAttr]){
                  collection[pAttr] = collectionObj[pAttr];
                }
              }

              this.jsondata.collection.push(collection);

            }

            //TODO if there is no view there should probably be an error shown
            if (collectionObj.view){
              for (var viewNode of collectionObj.view){
                //Change the id to include _node because collection and main view can have the same URI
                //We do still want to show them as two separate nodes even though they are the same thing

                let double = false;
                for (let checker of this.jsondata.nodes){
                  if (checker.id == viewNode['@id']+"_node"){
                    double = true;
                  }
                }

                if (!double){
                  let node = {};
                  node.id = viewNode['@id']+"_node";
                  node.type = "Node";
                  node.name = viewNode['@id'];
                  node.relation_count = metadata.nodes.get(viewNode['@id']).relation.length;
                  node.offsetX = this.jsondata.nodes.length;

                  let relation_holder = {};
                  relation_holder.id = viewNode['@id']+"_node";
                  relation_holder.node_id = viewNode['@id']+"_node";
                  relation_holder.name = viewNode['@id'];
                  relation_holder.relation_count = metadata.nodes.get(viewNode['@id']).relation.length;
                  relation_holder.offsetX = this.jsondata.relations_holder.length;

                  let possibleAttrs = ["import", "importStream", "conditionalImport", "search", "retentionPolicy"];
                  for (let pAttr of possibleAttrs){
                    if (viewNode[pAttr]){
                      node[pAttr] = viewNode[pAttr];
                      relation_holder[pAttr] = viewNode[pAttr];
                    }
                  }

                  this.jsondata.nodes.push(node);
                  this.jsondata.relations_holder.push(relation_holder)
                  this.jsondata.links.push({"source":collectionId, "target":viewNode['@id']+"_node", "name":"relation_holder"});
                }
              }
            } else {
              alert("Did not find any nodes linked to this url\n" + standardURL);
            }


            //TODO check what happens when as:items comes from a node not the collection

            if (collectionObj.member){
              let membIds = [];
              for (var memb of collectionObj.member){
                membIds.push(memb['@id']);
                this.extractId(store, memb['@id']).then(mtemp => this.members[standardURL].push(mtemp));
              }
              this.validateShape(membIds, store);
            } else {
              this.remarks += "Found no members for " + standardURL + ".\n";
            }

          }

          //This does not need a duplicate check since old node relations won't be included in the new metadata
          //or they will just overwrite with the exact same data as was already present
          for (var nodeId of metadata.nodes.keys()){
            var nodeObj = metadata.nodes.get(nodeId);
            this.jsondata[nodeId+"_node"] = [];
            for (var relation of nodeObj.relation){
              this.jsondata[nodeId+"_node"].push({"id":relation['@id'], "node_id":nodeId+"_node", "name":relation['@id']});
            }
          }

          let tempN = [];
          for (let relationNode of this.jsondata.relations_holder){
            //This will hold all newly added nodes to later check if they confirm to any already existing relations
            tempN.push(relationNode.id);
            for (var relationJson of this.jsondata[relationNode.id]){
              if (metadata.relations.get(relationJson.id)){

                var relationObj = metadata.relations.get(relationJson.id);
                if (!relationObj.node || !relationObj.node[0]['@id']){
                  alert("Error: relation from " + relationNode.id + " has no node defined!\nThis is not allowed!\nRelation: " + JSON.stringify(relationObj, null, '\t'));
                  break;
                }
                relationJson.node = relationObj.node;

                this.jsondata.relations.push({"source":relationNode.id, "target":relationObj.node[0]['@id']+"_node"});

                //TODO should there be a standard placeholder if not present? Now this gets rechecked in the drawing function
                if(!relationObj['@type']){
                  this.remarks += "relation from " + relationNode.name + " to " + relationObj.node[0]['@id'] + " has no type defined\n";
                } else {
                  relationJson.type = relationObj['@type'];
                }

                let wantedAttrs = ["path", "value", "remainingItems"];
                for (let wAttr of wantedAttrs){
                  if (relationObj[wAttr]){
                    relationJson[wAttr] = relationObj[wAttr];
                  } else {
                    this.remarks += "relation from " + relationNode.name + " to " + relationObj.node[0]['@id'] + " has no " + wAttr + " defined\n";
                  }
                }

                let possibleAttrs = ["import", "importStream", "conditionalImport"];
                for (let pAttr of possibleAttrs){
                  if (relationObj[pAttr]){
                    relationJson[pAttr] = relationObj[pAttr];
                  }
                }

                //This checks if the node this relation links to already exists in the graph
                if(this.jsondata[relationObj.node[0]['@id']+"_node"]){
                  this.jsondata.links.push({"source":relationNode.id, "target":relationObj.node[0]['@id']+"_node"});
                }

              }
            }

            //This checks if any of the newly added nodes are the target of a relation already on the graph
            for (let tempR of this.jsondata.relations){
              if (tempN.includes(tempR.target)){
                this.jsondata.links.push(tempR);
              }
            }

          }

          if (this.remarks != ""){
            //alert(this.remarks);
            console.log(this.remarks);
          }

          console.log("jsondata:");
          console.log(this.jsondata);

          console.log("members:");
          console.log(this.members);

          console.log("collt: ", this.jsondata.collection[0]);


          if (this.jsondata.shapes.length == 0 && metadata.collections.get(collectionId).shape){

            const shapeIds = this.getShapeIds(store);

            this.extractShapeId(store, shapeIds[0]).then(res => {
              this.jsondata.shapes.push({"id":shapeIds[0], "type":"shape", "shape_extra":res});
              this.jsondata.links.push({"source":collectionId, "target":shapeIds[0], "name":"shape"});
              this.drawing(metadata);
            });

          } else {
            this.drawing(metadata);
          }




        })

      });

    },

    getShapeIds(store){
      var shapeIds = [];
      shapeIds = shapeIds.concat(store.getQuads(null, 'https://w3id.org/tree#shape', null, null).map(quad => quad.object.id));
      shapeIds = shapeIds.concat(store.getQuads(null, 'http://www.w3.org/ns/shapetrees#validatedBy', null, null).map(quad => quad.object.id));
      shapeIds = shapeIds.concat(store.getQuads(null, 'http://www.w3.org/ns/shapetrees#shape', null, null).map(quad => quad.object.id));
      return shapeIds;
    },

    validateShape(membIds, store){
      const shapeIds = this.getShapeIds(store);

      if (shapeIds.size > 1){
        alert("Found multiple shapes, will only validate using the first one.\n" + JSON.stringify(shapeIds));
      }
      if (shapeIds.size == 0){
        this.remarks += "URL did not include a shacl shape given via tree:shape or st:validatedBy.\n"
      }

      async function loadDatasetX (stream) {
        const parser = new ParserN3({ factory });
        return factory.dataset().import(parser.import(await stream));
      }

      const shapesX = this.extractShape(store, shapeIds[0]);
      const dataX = this.extractShapeMembers(store, membIds);

      loadDatasetX(shapesX).then(shapes => {
        loadDatasetX(dataX).then(data => {
          const validator = new SHACLValidator(shapes, { factory });
          const report = validator.validate(data);

          this.shape_validation = report.conforms;
          this.shape_report = "Result report:\n";

          for (const result of report.results) {
            // See https://www.w3.org/TR/shacl/#results-validation-result for details about each propert
            this.shape_report += "\nmessage: \n";
            for (let mt of result.message){
              this.shape_report += "\t" + mt['value']+"\n";
            }
            this.shape_report += "path: " + result.path['value'] + "\n";
            this.shape_report += "focusNode: " + result.focusNode['value'] + "\n";
            this.shape_report += "severity: " + result.severity['value'] + "\n";
            this.shape_report += "sourceConstraintComponent: " + result.sourceConstraintComponent['value'] + "\n";
            this.shape_report += "sourceShape: " + result.sourceShape['value'] + "\n";
          }

          if (report.results.length == 0){
            this.shape_report += "All checks passed.";
          }

        });
      });
    },

    drawing(metadata) {
      console.log(metadata);
      const margin = {top: 10, right: 30, bottom: 10, left: 30};
      if(!this.graph_width){
        this.graph_width = 2000;
      }
      if(!this.graph_height){
        this.graph_height = 2000;
      }
      const width = this.graph_width - margin.left - margin.right;
      const height = this.graph_height - margin.top - margin.bottom;

      //clear the graph on redrawing
      d3.select("#my_dataviz").selectAll("svg").remove();

      var all = this.jsondata.collection.concat(this.jsondata.shapes.concat(this.jsondata.relations_holder));

      // append the svg object to the body of the page
      const svg = d3.select("#my_dataviz")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("pointer-events", "all");


      // check if the extra info svg exists, if not create it
      // This gets cleared in getData if we change collections
      if (!this.svgHolder){
        this.svgHolder = d3.select("#extra")
        .append("svg")
        .attr("pointer-events", "all");
      }
      const svgE = this.svgHolder;

      const svgEG = svgE.append("g");

      const svgM = d3.select("#extra")
      .append("svg")
      .attr("pointer-events", "all");

      const svgMG = svgM.append("g");



      //TODO find a way to make the arrowhead placed dynamically instead of using refX
      svg.append("marker")
      .attr("id", "arrow")
      //.attr("markerUnits","strokeWidth")//The arrow set to strokeWidth will change with the thickness of the line
      .attr("markerUnits","userSpaceOnUse")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX",55)//Arrow coordinates
      .attr("refY", -1)
      .attr("markerWidth", 12)//The size of the logo
      .attr("markerHeight", 12)
      .attr("orient", "auto")//Drawing direction, can be set to: auto (automatically confirm the direction) and angle value
      .attr("stroke-width",2)//arrow width
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")//The path of the arrow
      .attr('fill','gray');//Arrow color


      const link = svg.selectAll(".edgepath")
      .data(this.jsondata.links)
      .enter()
      .append("path")
      .style("stroke","gray")
      .style("pointer-events", "none")
      .style("stroke-width",0.5)//line thickness
      .attr("marker-end", "url(#arrow)" );


      const collection = svg
      .selectAll("gcollection")
      .data(this.jsondata.collection)
      .join("g")
      .attr("class", "collection_g main_g")
      .attr("expanded", "false")
      .on("click", clickCollection.bind(this))
      .call(d3.drag()
      .on("start", dragstartX)
      .on("end", dragendX)
      .on("drag", dragX));

      collection.append("text")
      .attr("text-anchor", "start")
      .attr("class", "collection_text main_text")
      .attr("dy",20)
      .attr("dx",5)
      .text(function(d) {
        return (d.type + "").split('#').pop()
      })
      .raise();

      collection.append("rect")
      .attr("class", "collection_rect main_rect")
      .attr("width", collection.select("text").node().getBBox().width+15)
      .attr("height", collection.select("text").node().getBBox().height+10)
      .style("fill", "#5fd145")
      .lower();



      const shape = svg
      .selectAll("gshape")
      .data(this.jsondata.shapes)
      .join("g")
      .attr("class", "shape_g main_g")
      .attr("expanded", "false")
      .on("click", clickShape.bind(this))
      .call(d3.drag()
      .on("start", dragstartX)
      .on("end", dragendX)
      .on("drag", dragX));

      shape.append("text")
      .attr("text-anchor", "start")
      .attr("class", "shape_text main_text")
      .attr("dy",20)
      .attr("dx",5)
      .text(function(d) {
        return (d.type + "").split('#').pop()
      })
      .raise();

      shape.append("rect")
      .attr("class", "shape_rect main_rect")
      .attr("width", shape.select("text").node().getBBox().width+15)
      .attr("height", shape.select("text").node().getBBox().height+10)
      .style("fill", "#5e915a")
      .lower();



      const relation_holder = svg
      .selectAll("grelation_holder")
      .data(this.jsondata.relations_holder)
      .join("g")
      .attr("class", "relation_holder_g main_g")
      .on("click", clickRelationHolder.bind(this))
      .call(d3.drag()
      .on("start", dragstartX)
      .on("end", dragendX)
      .on("drag", dragX));

      relation_holder.append("text")
      .attr("text-anchor", "start")
      .attr("class", "relation_holder_text main_text")
      .attr("dx", 5)
      .attr("dy",20)
      .text("")
      .raise();

      for (let tg of d3.selectAll(".relation_holder_g")){
        d3.select(tg).select("text")
        .append("tspan").text("Node")
        .attr("dy", 22)
        .attr("dx",5);

        d3.select(tg).select("text")
        .append("tspan").text(function(d){return d.name})
        .attr("dy", 22)
        .attr("x",0)
        .attr("dx",5);

        d3.select(tg).select("text")
        .append("tspan").text(function(d){return "relations: " + d.relation_count})
        .attr("dy", 22)
        .attr("x",0)
        .attr("dx",15);

        d3.select(tg).append("rect")
        .attr("class", "relation_holder_rect main_rect")
        .attr("width", d3.select(tg).node().getBBox().width+15)
        .attr("height", d3.select(tg).node().getBBox().height+10)
        .style("fill", "#69b3a2")
        .lower();
      }


      d3.forceSimulation(all)
      .force("link", d3.forceLink()
      .id(function(d) { return d.id; })
      .links(this.jsondata.links)
      //.distance(200)
      )
      .alphaDecay(this.alpha_decay_rate)
      .on("end", firstTick.bind(this));


      function firstTick(){
        console.log("firstticked");
        ticked();

        //TODO make this dynamic
        svg.selectAll(".collection_g").attr("x", function(d){d.x=50; return d.x}).attr("y", function(d){d.y=20; return d.y});
        svg.selectAll(".shape_g").attr("x", function(d){d.x=200+50; return d.x}).attr("y", function(d){d.y=20; return d.y});
        svg.selectAll(".node_g").attr("x", function(d){d.x=50+d.offsetX*500; return d.x}).attr("y", function(d){d.y=150; return d.y});
        svg.selectAll(".relation_holder_g").attr("x", function(d){d.x=50+d.offsetX*500; return d.x}).attr("y", function(d){d.y=300; return d.y});

        fixGroupChildren();
        fixLinks();
      }

      function ticked() {
        console.log("ticked");

        // This simply sets the attribute to the given (parent) data x and y
        d3.selectAll(".maing_g")
        .attr("x", function(d) {
          return d.x;
        })
        .attr("y", function(d) {
          return d.y;
        });

        fixGroupChildren();

        fixLinks();

      }

      function fixLinks(){
        link.attr("transform", "scale("+d3.select("svg").attr("scaleAll")+")");
        link.attr('d', function(d) {
          //TODO find a way to make the path go to the center, not the top corner by finding source, target width and height
          var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
          return path;
        });
      }

      function fixGroupChildren(){
        d3.selectAll(".main_text, .main_rect")
        .attr("x", function(d) {return d.x;})
        .attr("y", function(d) {return d.y;});

        svg.selectAll("tspan")
        .attr("x", function(d) {return d.x;})
      }


      //Use X at the end to not confuse with buildin stuff
      function dragstartX() {
        d3.select(this).attr("stroke", "black");
      }

      function dragX(e, d) {
        d3.select(this).attr("x", d.x = e.x).attr("y", d.y = e.y);
        ticked();
      }

      function dragendX() {
        d3.select(this).attr("stroke", null);
        ticked();
      }



      // The event.transform does not change during session, it simply gets added onto every time
      // So just safe the value on the main svg so we can use it in calculations
      // We can't use this with transform directly because links depend on actual x and y data, not the translated attributes
      svg.attr("prevTX", 0).attr("prevTY", 0).attr("scaleAll", 1);

      // d3 sees zooming and panning as the same thing, strange design choice
      const zoom = d3.zoom()

      //while panning links wont move because we use translate instead of changing x and y
      zoom.on("zoom", function(e) {
        if (e.sourceEvent.shiftKey){
          d3.selectAll(".main_g")
          .attr("transform", function(){return "translate("+(e.transform.x- d3.select("svg").attr("prevTX"))+","+(e.transform.y- d3.select("svg").attr("prevTY"))+")scale("+e.transform.k+")"});

          fixLinks();
          link.attr("transform", function(){return "translate("+(e.transform.x- d3.select("svg").attr("prevTX"))+","+(e.transform.y- d3.select("svg").attr("prevTY"))+")scale("+e.transform.k+")"});
        }
      });

      // At the end of a zoom we only keep scale attribute and calculate the correct x and y attributes based of the translation
      zoom.on("end", function(e) {
        if (e.sourceEvent.shiftKey){
          d3.selectAll(".main_g")
          .attr("transform", function(){return "scale("+e.transform.k+")"})
          .attr("x", function(d) { d.x += e.transform.x - d3.select("svg").attr("prevTX")})
          .attr("y", function(d) { d.y += e.transform.y - d3.select("svg").attr("prevTY")})

          svg.attr("prevTX", e.transform.x).attr("prevTY", e.transform.y).attr("scaleAll", e.transform.k);

          fixGroupChildren()

          fixLinks();
        }
      });

      // connect the zoom function to the main svg element
      svg.call(zoom);

      function clickCollection(e, d){
        let currentg = d3.select(e.target.parentNode);
        if (!currentg.classed("collection_g")){
          currentg = d3.select(currentg._groups.pop().pop().parentNode);
        }

        expandCollection.bind(this)(currentg, d);

        ticked();
      }

      function expandCollection(currentg, d){
        if(currentg.attr("expanded") == "false"){
          currentg.attr("expanded", "true");

          expandCollectionTrue.bind(this)(currentg, d);

        } else {
          currentg.attr("expanded", "false");

          currentg.select("text").text((d.type + "").split('#').pop())
          currentg.select("rect").attr("width", 1);

          currentg.select("text").selectAll("tspan")
          .attr("x", function(d) {return d.x;})

          currentg.select("rect")
          .attr("height", 30)
          .attr("width", currentg.node().getBBox().width + 10);
        }
      }

      function expandCollectionTrue(currentg, d){
        currentg.raise();
        currentg.select("text").text("");
        let tt = currentg.select("text");

        tt.append("tspan").text("Collection")
        .attr("dy", 22)
        .attr("dx",5);

        tt.append("tspan").text(d.id)
        .attr("dy", 22)
        .attr("x",0)
        .attr("dx",15);

        let possibleAttrs = ["import", "importStream", "conditionalImport", "totalItems"];
        for (let pAttr of possibleAttrs){
          if (d[pAttr]){
            tt.append("tspan").text(`${pAttr}:`)
            .attr("dy", 22)
            .attr("x",0)
            .attr("dx",5);
            for (const [key, value] of d[pAttr]) {
              tt.append("tspan").text(`${key}: ${value}`)
              .attr("dy", 22)
              .attr("x",0)
              .attr("dx",15);
            }
          }
        }

        currentg.select("rect")
        .attr("height", 10 + currentg.select("text").node().getBBox().height)

        currentg.select("text").selectAll("text, tspan")
        .attr("x", function(d) {return d.x;})

        currentg.select("rect").attr("width", currentg.node().getBBox().width + 10);
      }

      function clickShape(e, d){
        let currentg = d3.select(e.target.parentNode);
        if (!currentg.classed("shape_g")){
          currentg = d3.select(currentg._groups.pop().pop().parentNode);
        }

        expandShape.bind(this)(currentg, d);

        ticked();
      }


      function expandShape(currentg, d){
        if(currentg.attr("expanded") == "false"){
          currentg.attr("expanded", "true");

          expandShapeTrue.bind(this)(currentg, d);

        } else {
          currentg.attr("expanded", "false");

          currentg.select("text").text((d.type + "").split('#').pop())
          currentg.select("rect").attr("width", 1);

          currentg.select("text").selectAll("tspan")
          .attr("x", function(d) {return d.x;})

          currentg.select("rect")
          .attr("height", 30)
          .attr("width", currentg.node().getBBox().width + 10);
        }
      }

      function expandShapeTrue(currentg, d){
        currentg.raise();

        let textArray = d.shape_extra.split('\n');

        currentg.select("rect")
        .attr("height", 10 + 20*textArray.length)

        currentg.select("text").text("");

        for (let textX of textArray){
          let indent = (textX.split('\t').length -1) * 20;
          currentg.select("text").append('tspan')
          .text(textX.replace('\t',''))
          .attr("dy", 20)
          .attr("dx", indent + 5);
        }

        currentg.select("text").selectAll("text, tspan")
        .attr("x", function(d) {return d.x;})

        currentg.select("rect").attr("width", currentg.node().getBBox().width + 10);
      }


      function clickRelationHolder(e, d){
        svgEG.selectAll("g").remove();
        svgMG.selectAll("g").remove();
        console.log(this.selected);
        if (this.selected == "1" && d.relation_count && d.relation_count > 0){
          let currentg = d3.select(e.target.parentNode);
          //currentg could be tspan parent = text and not the group
          if (!currentg.classed("relation_holder_g")){
            currentg = d3.select(currentg._groups[0][0].parentNode);
          }

          expandRelationHolder.bind(this)(currentg, d);

          ticked();
        }

        if (this.selected == "2" && this.members[d.name]){
          expandMember.bind(this)(d);
        } else if (this.selected == "2"){
          expandMember.bind(this)(d, false);
        }
      }

      function expandMember(d, hasMembers=true){


        let newG = svgMG.append("g").attr("class", "new_g")
        .attr("node_id", d.node_id);

        if (hasMembers){
          let textArray = [];
          for (let tempA of this.members[d.name]){
            if (tempA.includes('\n')){
              for (let tempB of tempA.split('\n')){
                textArray.push(tempB);
              }
            } else {
              textArray.push(tempA);
            }
          }

          newG.append("text").text("");

          for (let textX of textArray){
            let indent = (textX.split('\t').length -1) * 20;
            newG.select("text").append('tspan')
            .text(" " + textX)
            .attr("dy", 20)
            .attr("dx", indent + 5)
            .attr("x", 0);
          }

          newG.append("rect").attr("x", 0).attr("y", 0).attr("height", 10 + 20*textArray.length).attr("width",0).style("fill", "#5e915a");
          newG.select("rect").attr("width", newG.node().getBBox().width + 10).lower();
        } else {
          newG.append("text").text("This node has no members.")
          .attr("dy", 20)
          .attr("dx", 5)
          .attr("x", 0);

        }



        let bbox = svgMG.node().getBBox();
        svgM.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
        .attr("width", (bbox.width+bbox.x))
        .attr("height", (bbox.height+bbox.y));

        bbox = svgEG.node().getBBox();
        svgE.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
        .attr("width", (bbox.width+bbox.x))
        .attr("height", (bbox.height+bbox.y));
      }


      function expandRelationHolder(currentg, d){

        svgEG.selectAll("g").remove();

        let sortIndex = -1;
        let offsetY = Number(currentg.select("rect").attr("height"));

        let colors = ["#706ec4", "#7977d9"]

        let newG = svgEG.append("g").attr("class", "new_g")
        .attr("node_id", d.node_id);

        for (let relX of this.jsondata[d.node_id]){
          sortIndex++;
          let innerg = newG.append("g")
          .attr("sortIndex", sortIndex)
          .attr("x", 50)
          .attr("class", "relation_g")
          .attr("info", JSON.stringify(relX))
          .attr("expanded", "false");

          let innerText = innerg.append("text")
          .attr("text-anchor", "start")
          .attr("class", "relation_text inner_text")
          .attr("x", 50)
          .attr("sortIndex", sortIndex)
          .text("")
          .raise();
          let textX = "";
          if(relX.type){
            textX += (relX.type + "").split('#').pop() + ": "
          } else {
            textX += "No Type"
          }

          if (relX.value){
            for (let v of relX.value){
              textX += v['@value'] + ", ";
            }
          } else {
            textX += "No Value";
          }

          if (relX.path){
            for (let v of relX.path){
              if(!v['@id']){
                textX += 'Object'
              } else {
                textX += v['@id']//(v['@id'] + "").split("/").pop();
              }
            }
          } else {
            textX += "No Path";
          }



          let itspan = innerText.append('tspan')
          .text(textX)
          .attr("dy", 20)
          .attr("x", 35)
          .attr("sortIndex", sortIndex);

          innerText.attr("y", function(){return sortIndex*25 + offsetY});
          innerg.attr("y", function(){return sortIndex*25 + offsetY});

          innerg.append("rect")
          .attr("class", "relation_rect inner_rect")
          .attr("node_link", relX.node[0]['@id'])
          .attr("sortIndex", sortIndex)
          .attr("height", 25)
          .attr("x", 30)
          .attr("y", function(){return sortIndex*25 + offsetY})
          .style("fill", colors[sortIndex%2])
          .lower();

          if(relX.node){
            innerg.attr("node_link", relX.node[0]['@id']);
            innerText.attr("node_link", relX.node[0]['@id']);
            itspan.attr("node_link", relX.node[0]['@id']);
          }

          innerg.on("click", expandRelation.bind(this));
        }

        newG.selectAll(".inner_rect").attr("width", newG.node().getBBox().width+10);

        let tt = newG.append("text");

        tt.append("tspan").text("Node")
        .attr("dy", 22)
        .attr("dx",5);

        tt.append("tspan").text(d.name)
        .attr("dy", 22)
        .attr("x",0)
        .attr("dx",5);

        tt.append("tspan").text("relations: " + d.relation_count)
        .attr("dy", 22)
        .attr("x",0)
        .attr("dx",15);

        let possibleAttrs = ["import", "importStream", "conditionalImport", "search", "retentionPolicy"];
        for (let pAttr of possibleAttrs){
          if (d[pAttr]){
            tt.append("tspan").text(`${pAttr}:`)
            .attr("dy", 22)
            .attr("x",0)
            .attr("dx",5);
            for (const [key, value] of d[pAttr]) {
              tt.append("tspan").text(`${key}: ${value}`)
              .attr("dy", 22)
              .attr("x",0)
              .attr("dx",15);
            }
          }
        }

        newG.append("rect").attr("x", 0).attr("y", 0).style("fill", "#69b3a2")
        .attr("width", newG.node().getBBox().width+30)
        .attr("height", newG.node().getBBox().height+30)
        .attr("class", "outer_rect")
        .lower();


        // Make the main svg holding this large enough to show everything
        let bbox = svgEG.node().getBBox();
        svgE.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
        .attr("width", (bbox.width+bbox.x))
        .attr("height", (bbox.height+bbox.y));
      }


      function expandRelation(e){
        e.stopPropagation();
        if (!e.ctrlKey){


          let currentg = e.target;
          while(!d3.select(currentg).classed("relation_g")){
            currentg = currentg.parentNode;
          }

          let heightStart = d3.select(currentg).node().getBBox().height;
          let tspanX = d3.select(currentg).select("tspan").attr("x");
          if(d3.select(currentg).attr("expanded")=="false"){
            d3.select(currentg).attr("expanded", "true");
            d3.select(currentg).raise();

            d3.select(currentg).selectAll("rect, text, tspan").style("visibility", "hidden");


            let tt = d3.select(currentg).append("text").text("")
            .attr("text-anchor", "start")
            .attr("class", "pop_up")
            .attr("x", d3.select(currentg).select(".inner_text").attr("x"))
            .attr("y", d3.select(currentg).select(".inner_text").attr("y"));

            let relX = JSON.parse(d3.select(currentg).attr("info"));
            if (relX.type){
              tt.append("tspan").text("type: " + relX.type);
            } else {
              tt.append("tspan").text("Relation has no type");
            }

            if (relX.value){
              for (let v of relX.value){
                if(!v['@value']){
                  tt.append("tspan").text("value: ");
                  let textArray = JSON.stringify(v, null, '\t').split('\n');
                  let prevIndent = 0;
                  for (let textX of textArray){
                    let indent = (textX.split('\t').length -1) * 4;
                    tt.append('tspan')
                    .text(textX.replace('\t',''))
                    .attr("dy", 20)
                    .attr("dx", indent-prevIndent + 10);
                    prevIndent = indent-prevIndent;
                  }
                } else {
                  tt.append("tspan").text("value: " + v['@value']);
                }
              }
            } else {
              tt.append("tspan").text("Relation has no value");
            }


            if (relX.path){
              for (let v of relX.path){
                if(!v['@id']){
                  tt.append("tspan").text("path: ");
                  let textArray = JSON.stringify(v, null, '\t').split('\n');
                  let prevIndent = 0;
                  for (let textX of textArray){
                    let indent = (textX.split('\t').length -1) * 4;
                    tt.append('tspan')
                    .text(textX.replace('\t',''))
                    .attr("dy", 20)
                    .attr("dx", indent-prevIndent + 10);
                    prevIndent = indent-prevIndent;
                  }
                } else {
                  tt.append("tspan").text("path: " + v['@id']);
                }
              }
            } else {
              tt.append("tspan").text("Relation has no path");
            }

            if (relX.node){
              for (let v of relX.node){
                tt.append("tspan").text("node: " + v['@id']);
              }
            } else {
              tt.append("tspan").text("Relation has no node");
            }


            if (relX.remainingItems){
              for (let v of relX.remainingItems){
                tt.append("tspan").text("remainingItems: " + v['@value']);
                if(v['@type']){
                  tt.append("tspan").text("remainingItemsType: " + v['@type']);
                }
              }
            }

            let possibleAttrs = ["import", "importStream", "conditionalImport"];
            for (let pAttr of possibleAttrs){
              if (relX[pAttr]){
                tt.append("tspan").text(`${pAttr}:`)
                .attr("dy", 22)
                .attr("x",0)
                .attr("dx",0);
                for (const [key, value] of relX[pAttr]) {
                  tt.append("tspan").text(`${key}: ${value}`)
                  .attr("dy", 22)
                  .attr("x",0)
                  .attr("dx",10);
                }
              }
            }



            tt.selectAll("tspan").attr("dy", 20).attr("x", 5+Number(tspanX));
            tt.selectAll("tspan").raise();

            let colors = ["#c4b727", "#d4c957"];
            let trect = d3.select(currentg).append("rect").style("fill", colors[Number(d3.select(currentg).attr("sortIndex"))%2])
            .attr("class", "pop_up")
            .attr("x", d3.select(currentg).select(".inner_rect").attr("x"))
            .attr("y", d3.select(currentg).select(".inner_rect").attr("y"))
            .attr("width", d3.select(currentg).select("text.pop_up").node().getBBox().width+20)
            .attr("height", d3.select(currentg).node().getBBox().height)
            .lower();



            if(relX.node){
              tt.attr("node_link", relX.node[0]['@id']);
              trect.attr("node_link", relX.node[0]['@id']);
              tt.selectAll("tspan").attr("node_link", relX.node[0]['@id']);
            }

          // If was already expanded
          } else {
            d3.select(currentg).attr("expanded", "false");
            d3.select(currentg).selectAll(".pop_up").remove();
            d3.select(currentg).selectAll("rect, text, tspan").style("visibility", "visible");
          }

          // Fix all rectangle sizes and move lower items downwards
          let heightNew = Number(d3.select(currentg).node().getBBox().height) - heightStart

          for(let tn of d3.select(currentg.parentNode).selectAll(".relation_g")){
            if (Number(d3.select(tn).attr("sortIndex")) > Number(d3.select(currentg).attr("sortIndex"))){
              d3.select(tn).attr("y", heightNew + Number(d3.select(tn).attr("y")));
              d3.select(tn).selectAll("text, rect").attr("y", d3.select(tn).attr("y"));

            }
          }

          // First make the rectangles size 0 so they do not already expand the main viewbox we then use to set their attributes
          d3.select(currentg.parentNode).selectAll(".inner_rect").attr("width", 0);
          d3.select(currentg.parentNode).selectAll(".outer_rect").attr("width", 0).attr("height", 0);

          // The 25 here is because tspan already moves 5 to the right so 30-5 = 25
          d3.select(currentg.parentNode).selectAll(".inner_rect")
          .attr("width", d3.select(currentg.parentNode).node().getBBox().width-25);

          d3.select(currentg.parentNode).selectAll(".outer_rect")
          .attr("width", d3.select(currentg.parentNode).node().getBBox().width+30)
          .attr("height", d3.select(currentg.parentNode).node().getBBox().height+30);

          let bbox = svgEG.node().getBBox();
          svgE.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
          .attr("width", (bbox.width+bbox.x))
          .attr("height", (bbox.height+bbox.y));

          bbox = svgMG.node().getBBox();
          svgM.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
          .attr("width", (bbox.width+bbox.x))
          .attr("height", (bbox.height+bbox.y));

        //if ctrl was pressed, add new node
        } else {
          console.log(d3.select(e.target).attr("node_link"));
          this.getData(d3.select(e.target).attr("node_link"));
        }
      }




    }

  }

}

</script>


<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
}

#extra {
  width:100%;
  height:600px;
  overflow: scroll;
}

svg{
  vertical-align: top;
}
</style>
