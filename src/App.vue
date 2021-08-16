<template>

  <p style="white-space: pre-line">Click a node, relation or shape to show all attributes<br>
  ctrl+click a relation to add the node to the graph<br>
  shift+mousewheel / shift+pan to zoom or pan<br>
  Drag screen corner to resize views</p>

  <label for="adecay">Enter graph convergence speed, between 0 and 1</label>
  <input type="number" v-model="alpha_decay_rate" placeholder="0.023" name="adecay"><br>

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

  <div id="my_dataviz" style="overflow:scroll; resize: both;"></div>





<!-- This empty div allows user to resize extra info screen easily -->
  <div style="height: 100px;"></div>

  <div id="windowContainer">
    <div class="divFloat" id="scrollContainer">
      <div v-on:click="close()" class="close"></div>
      <div class="container">

        <select v-model="selected">
          <option value="1">Node</option>
          <option value="2">Members</option>
          <option value="3">Shape validation</option>
        </select>
      </div>
      <div id="extra"></div>
    </div>
  </div>

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
      jsondata: null, //this will be set to empty on start of getData
      members: {},
      membersFailed : [],
      svgHolder: null,
      svgGHolder: null,
      remarks: "",
      next_url: "",
      checked_shape: false,
      graph_height: 600,
      graph_width: 1000,
      data_url: null,
      shape_validation: null,
      node_validation: [],
      shape_report: "",
      selected: "1",
      alpha_decay_rate: 0.5,//1 - Math.pow(0.001, 1 / 300)
      shapeTargets: ['targetClass', 'targetNode', 'targetSubjectsOf', 'targetObjectsOf'],
      // Add possible properties from metadata extraction to these arrays
      collectionSpecial: ["@type", "import", "importStream", "conditionalImport", "totalItems"],
      nodeSpecial: ["@type", "import", "importStream", "conditionalImport", "search", "retentionPolicy"],
      // value, path, node, remainingItems are checked in a different way
      relationSpecial: ["import", "importStream", "conditionalImport"]
    }
  },
  watch: {
    selected: {
      handler() {
        this.drawing.setVisible();
      },
    }
  },
  methods : {
    clearData(){
      this.jsondata = {"collection":[], "relations":[], "links":[], "shapes":[], "relations_holder":[]};
      this.shape_validation = null;
      this.node_validation = [];
      d3.select("#extra").selectAll("svg").remove();
      this.svgHolder = null;
      this.svgGHolder = null;
      this.members = {};
      this.membersFailed = [];
      this.shape_report = "";
    },
    close(){
      document.getElementById("windowContainer").style.display = "none";
    },
    open(){
      document.getElementById("windowContainer").style.display = "block";
    },
    async extractId(store, id) {
      const quadsWithSubj = store.getQuads(id, null, null, null);
      const textStream = rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
      return await stringifyStream(textStream);
    },

    async extractShapeId(store, id){
      const quadsWithSubj = this.extractShapeHelp(store, id);
      const textStream = rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
      return await stringifyStream(textStream);
    },

    getShapeIds(store){
      var shapeIds = [];
      shapeIds = shapeIds.concat(store.getQuads(null, 'https://w3id.org/tree#shape', null, null).map(quad => quad.object.id));
      shapeIds = shapeIds.concat(store.getQuads(null, 'http://www.w3.org/ns/shapetrees#validatedBy', null, null).map(quad => quad.object.id));
      shapeIds = shapeIds.concat(store.getQuads(null, 'http://www.w3.org/ns/shapetrees#shape', null, null).map(quad => quad.object.id));
      return shapeIds;
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
      var quadsWithSubj = this.extractShapeHelp(store, id);

      const store2 = new N3.Store();
      store2.addQuads(quadsWithSubj);
      var targetQuads = [];
      const shapeTargets = this.shapeTargets;
      for (let tempTarget of shapeTargets){
        targetQuads = targetQuads.concat(store2.getQuads(null, 'http://www.w3.org/ns/shacl#'+tempTarget, null, null))
      }

      if (targetQuads.length == 0){
        // This check for implicit targetting TODO check if this actually works
        let t1 = targetQuads.concat(store2.getQuads(id, 'http://www.w3.org/ns/shacl#'+'NodeShape', null, null));
        let t2 = targetQuads.concat(store2.getQuads(id, 'http://www.w3.org/2000/01/rdf-schema#Class', null, null));

        // If no target was given for the shape, make it target all tree:member objects
        if (t1.length == 0 || t2.length == 0){
          store2.addQuad(
            namedNode(id),
            namedNode('http://www.w3.org/ns/shacl#targetObjectsOf'),
            namedNode('https://w3id.org/tree#member'),
            defaultGraph()
          );

          quadsWithSubj = this.extractShapeHelp(store2, id);
        }

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
      //Need to always clear these values before getting new data
      this.qtext = [];
      this.remarks = "";

      //var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/a.nt';
      var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/.root.nt'
      standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/stops_a4.nt';
      standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/cht_1_2.ttl';
      // standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/marine1.jsonld';

      if(url){
        standardURL = url;
      } else if (this.data_url){
        standardURL = this.data_url;
        // This means user gave a url for a new collection so we need to clear whatever data we already had
        this.clearData();
        d3.select("#extra").selectAll("svg").remove();
        this.svgHolder = null;
      } else {
        //Fallback
        this.clearData();
        d3.select("#extra").selectAll("svg").remove();
        this.svgHolder = null;
      }

      const {quads} = await rdfDereferencer.dereference(standardURL);
      quads.on('data', (quad) => {this.qtext.push(quad); /*console.log(quad)*/})
      .on('error', (error) => console.error(error))
      .on('end', () => {
        extractMetadata(this.qtext).then(metadata => {

          const store = new N3.Store(this.qtext)

          // Having more than one collection is wrong but we can still try drawing a graph
          if (metadata.collections.size > 1){
            let errorText = "";
            errorText += "ERROR: found multiple collections! This is not allowed.\n";
            errorText += JSON.stringify(metadata.collections, null, '/t');
            errorText += "\ncheck tree:view, hydra:view, void:subset, dct:isPartOf, as:partOf.";
            errorText += "\nOther causes: \nmembers/shape are linked not to the collection but the node.";
            errorText += "\ncheck tree:member, hydra:member, as:items, ldp:contains.";
            alert(errorText);
          }


          // If no 'new' collection was found, we might already have a collection stored
          if (metadata.collections.size == 0){
            if (this.jsondata.collection.length == 0){
              alert("No collection pre-defined and no collection found on " + standardURL + ".\nPlease provide a different starting URL.");
              return;
            }

            if (!this.jsondata[standardURL+"_node"]){
              this.jsondata[standardURL+"_node"] = [];
              alert("no collection metadata found at " + standardURL + ".\nWill add an empty node for this URL.");
              this.jsondata.relations_holder.push({"id":standardURL+"_node", "name":standardURL, "relation_count":0})
              this.jsondata.links.push({"source":this.jsondata.collection[0].id, "target":standardURL+"_node"});
            }
          }


          // The main data parsing part
          for (var collectionId of metadata.collections.keys()) {
            var collectionObj = metadata.collections.get(collectionId);


            // If we already had a collection stored, check to make sure the 'new' one is the same as the old one
            let double = true;
            if (this.jsondata.collection.length > 0){
              for (let checker of this.jsondata.collection){
                if (checker.id != collectionId){
                  console.log(checker.id, collectionId)
                  double = false;
                }
              }
            }


            // If the new collection is not the same throw an error
            if (!double){
              let errorText = "";
              errorText += "ERROR: new node is linked to a different collection! This is not allowed.";
              errorText += '\n' + "current URL: " + standardURL;
              errorText += '\n' + "new collection: " + collectionId;
              errorText += '\n' + "original collection: " + this.jsondata.collection[0].id;
              alert(errorText);
              return;
            }


            // If we did not have a collection stored already add it to jsondata.collection
            if (this.jsondata.collection.length == 0){
              let collection = {};
              collection.id = collectionId;
              collection.type = "Collection";
              collection.vocab = collectionObj['@context']["@vocab"];

              for (let pAttr of this.collectionSpecial){
                if (collectionObj[pAttr]){
                  collection[pAttr] = collectionObj[pAttr];
                }
              }

              this.jsondata.collection.push(collection);
            }


            // Check for new nodes, either defined via collection->view or directly via nodes
            if (collectionObj.view || metadata.nodes.size > 0){
              let iter = (metadata.nodes.size > 0) ? metadata.nodes.values() : collectionObj.view;
              for (var viewNode of iter){

                // Change the id by appending _node because collection and view can have the same URI
                // We do still want to show them as two separate nodes even though they have the same URL

                let double = false;
                for (let checker of this.jsondata.relations_holder){
                  if (checker.id == viewNode['@id']+"_node"){
                    double = true;
                  }
                }

                if (!double){
                  let relation_holder = {};
                  relation_holder.id = viewNode['@id']+"_node";
                  relation_holder.name = viewNode['@id'];
                  relation_holder.relation_count = metadata.nodes.get(viewNode['@id']).relation.length;

                  for (let pAttr of this.nodeSpecial){
                    if (viewNode[pAttr]){
                      relation_holder[pAttr] = viewNode[pAttr];
                    }
                  }

                  this.jsondata.relations_holder.push(relation_holder)
                  this.jsondata.links.push({"source":collectionId, "target":viewNode['@id']+"_node", "name":"relation_holder"});
                }
              }
            } else {
              alert("Did not find any nodes linked to this url\n" + standardURL);
            }


            //TODO check what happens when as:items comes from a node not the collection
            const newNodeMembersId = this.jsondata.relations_holder[this.jsondata.relations_holder.length -1].name;
            this.members[newNodeMembersId] = new Map();
            if (collectionObj.member){
              let membIds = [];
              for (var memb of collectionObj.member){
                membIds.push(memb['@id']);
                // Need to save id inside loop because used in async push
                let tX = memb['@id'];
                this.extractId(store, memb['@id']).then(mtemp => {
                  this.members[newNodeMembersId].set(
                    tX, mtemp
                  )
                });
              }
              if (this.jsondata.shapes.size > 0 || collectionObj.shape){
                this.validateShape(membIds, store, newNodeMembersId);
              }
            } else {
              this.remarks += "Found no members for " + newNodeMembersId + ".\n";
            }

          }

          //This does not need a duplicate check since old node relations won't be included in the new metadata
          //or they will just overwrite with the exact same data as was already present
          for (var nodeId of metadata.nodes.keys()){
            var nodeObj = metadata.nodes.get(nodeId);
            this.jsondata[nodeId+"_node"] = [];
            for (var relation of nodeObj.relation){
              this.jsondata[nodeId+"_node"].push({"id":relation['@id'], "name":relation['@id']});
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

                for (let pAttr of this.relationSpecial){
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
            alert(this.remarks);
            console.log(this.remarks);
          }

          console.log("metadata:");
          console.log(metadata);

          console.log("jsondata:");
          console.log(this.jsondata);

          console.log("members:");
          console.log(this.members);


          // TODO does the shape need to be changed every time we switch nodes or can we just keep it stored
          if (this.jsondata.shapes.length == 0 && metadata.collections.get(collectionId).shape){
            console.log(metadata.collections.get(collectionId).shape)
            const shapeIds = this.getShapeIds(store);

            this.extractShapeId(store, shapeIds[0]).then(res => {
              this.jsondata.shapes.push({"id":shapeIds[0], "type":"shape", "shape_extra":res});
              this.jsondata.links.push({"source":collectionId, "target":shapeIds[0]});
              this.drawing();
            });

          } else {
            this.drawing();
          }

        })

      });

    },

    validateShape(membIds, store, newNodeMembersId){
      this.membersFailed[newNodeMembersId] = [];
      this.node_validation[newNodeMembersId] = {};
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

          let dtX = [];
          for (let sX of shapes){
            if (sX.object.termType == "BlankNode" && !dtX.includes(sX.object.value)){
              sX.object.value = sX.object.value.slice(3);
              dtX.push(sX.object.value)
            }
            if (sX.subject.termType == "BlankNode" && !dtX.includes(sX.subject.value)){
              sX.subject.value = sX.subject.value.slice(3);
              dtX.push(sX.subject.value)
            }
          }

          const validator = new SHACLValidator(shapes, { factory });
          const report = validator.validate(data);

          if (this.shape_validation && this.shape_validation === false){
            this.shape_validation = false;
          } else {
            this.shape_validation = report.conforms;
          }

          this.shape_report += "\nResult report for "+newNodeMembersId+":\n";

          for (const result of report.results) {
            // See https://www.w3.org/TR/shacl/#results-validation-result for details about each property
            let mX = "";

            mX += "\nmessage: \n";
            for (let mt of result.message){
              mX += "\t" + mt['value']+"\n";
            }
            mX += "path: " + result.path['value'] + "\n";
            mX += "focusNode: " + result.focusNode['value'] + "\n";
            this.membersFailed[newNodeMembersId].push(result.focusNode['value']);
            mX += "severity: " + result.severity['value'] + "\n";
            mX += "sourceConstraintComponent: " + result.sourceConstraintComponent['value'] + "\n";
            mX += "sourceShape: " + result.sourceShape['value'] + "\n";

            this.shape_report += mX;

            if (result.focusNode && result.focusNode['value']){
              this.node_validation[result.focusNode['value']] = mX;
            }
          }

          if (report.results.length == 0){
            this.shape_report += "All checks passed.";
          }

        });
      });
    },


    drawing() {
      const margin = {top: 10, right: 30, bottom: 10, left: 30};

      const width = this.graph_width - margin.left - margin.right;
      const height = this.graph_height - margin.top - margin.bottom;

      //clear the graph on redrawing
      d3.select("#my_dataviz").selectAll("svg").remove();

      var all = this.jsondata.collection.concat(this.jsondata.shapes.concat(this.jsondata.relations_holder));

      // append the svg object to the body of the page
      const svg = d3.select("#my_dataviz")
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("pointer-events", "all");

      // check if the extra info svgs exist, if not create them
      // This gets cleared in getData if we change collections
      if (!this.svgHolder){
        this.svgHolder =
        [
          d3.select("#extra")
          .append("svg")
          .attr("pointer-events", "all"),
          d3.select("#extra")
          .append("svg")
          .attr("pointer-events", "all"),
          d3.select("#extra")
          .append("svg")
          .attr("pointer-events", "all")
        ]
        this.svgGHolder =
        [
          this.svgHolder[0].append("g"),
          this.svgHolder[1].append("g"),
          this.svgHolder[2].append("g")
        ]
        d3.select("#my_dataviz")
        .style("width", width + margin.left + margin.right+"px")
        .style("height", height + margin.top + margin.bottom+"px");
      }

      const svgE = this.svgHolder[0];
      const svgM = this.svgHolder[1];
      const svgS = this.svgHolder[2];

      const svgEG = this.svgGHolder[0];
      const svgMG = this.svgGHolder[1];
      const svgSG = this.svgGHolder[2];



      //TODO find a way to make the arrowhead on the link-line placed dynamically instead of using refX
      svg.append("marker")
      .attr("id", "arrow")
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
      .style("stroke-width",0.5)
      .attr("marker-end", "url(#arrow)" );


      if (this.jsondata.collection.length > 0){
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
        .style("stroke", "#5fd145")
        .lower();
      }



      if (this.jsondata.shapes.length > 0){
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
        .style("stroke", "#5e915a")
        .lower();
      }



      if (this.jsondata.relations_holder.length > 0){
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
          .attr("dx",5);

          d3.select(tg).select("text")
          .append("tspan").text(function(d){return "relations: " + d.relation_count})
          .attr("dy", 22)
          .attr("dx",15);

          d3.select(tg).append("rect")
          .attr("class", "relation_holder_rect main_rect")
          .attr("width", d3.select(tg).node().getBBox().width+15)
          .attr("height", d3.select(tg).node().getBBox().height+10)
          .style("stroke", "#69b3a2")
          .lower();
        }
      }



      d3.forceSimulation(all)
      .force("link", d3.forceLink()
      .id(function(d) { return d.id; })
      .links(this.jsondata.links)
      )
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(100))
      .alphaDecay(this.alpha_decay_rate)
      .on("end", firstTick.bind(this));


      function firstTick(){
        ticked();

        svg.selectAll(".collection_g").attr("x", function(d){d.x=50; return d.x}).attr("y", function(d){d.y=20; return d.y});
        svg.selectAll(".shape_g").attr("x", function(d){d.x=200+50; return d.x}).attr("y", function(d){d.y=20; return d.y});

        fixGroupChildren();
        fixLinks();
      }


      function ticked() {
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

        let possibleAttrs = this.collectionSpecial;
        for (let pAttr of possibleAttrs){
          if (d[pAttr]){
            tt.append("tspan").text(`${pAttr}:`)
            .attr("dy", 22)
            .attr("x",0)
            .attr("dx",5);
            for (const value of Object.values(d[pAttr])) {
              let textArray = JSON.stringify(value, null, '\t').split('\n');
              let regex = /^(\t*{\t*)|(\t*}\t*)|(\t*],*\t*)$/g;
              for (let textX of textArray){
                if (!textX.match(regex)){
                  let indent = (textX.split('\t').length -1) * 20;
                  tt.append('tspan')
                  .text(" " + textX.replace(': [',': '))
                  .attr("dy", 22)
                  .attr("dx", indent + 15)
                  .attr("x", 0);
                }

              }
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


      this.drawing.setVisible = setVisible.bind(this);
      function setVisible(){
        if (this.selected == "1"){
          svgE.attr("display", "inline");
          svgM.attr("display", "none");
          svgS.attr("display", "none");
        } else if (this.selected == "2"){
          svgE.attr("display", "none");
          svgM.attr("display", "inline");
          svgS.attr("display", "none");
        } else if (this.selected == "3"){
          svgE.attr("display", "none");
          svgM.attr("display", "none");
          svgS.attr("display", "inline");
        }

        var el = document.getElementById("scrollContainer");
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }



      function clickRelationHolder(e, d){
        svgEG.selectAll("g").remove();
        svgMG.selectAll("g").remove();
        svgSG.selectAll("g").remove();

        // Display everything first so they have a correct viewbox attribute to use in calculations
        svgE.attr("display", "inline");
        svgM.attr("display", "inline");
        svgS.attr("display", "inline");
        this.open();

        if (d.relation_count && d.relation_count > 0){
          let currentg = d3.select(e.target.parentNode);
          //currentg could be tspan parent = text and not the group
          if (!currentg.classed("relation_holder_g")){
            currentg = d3.select(currentg._groups[0][0].parentNode);
          }

          expandRelationHolder.bind(this)(currentg, d);
          ticked();
        }

        expandMemberHolder.bind(this)(d);

        expandValidationHolder.bind(this)(d);

        setVisible.bind(this)();
      }



      function expandValidationHolder(d){
        let newG = svgSG.append("g").attr("class", "new_g")
        let textArray = [];

        for (let tempA of this.jsondata.shapes){
          textArray = textArray.concat(tempA.shape_extra.split('\n'));
        }

        let tt = newG.append("text").text("Shape:")
        .attr("y", 22);

        for (let textX of textArray){
          let indent = (textX.split('\t').length -1) * 20;
          tt.append('tspan')
          .text(textX.replace('\t',''))
          .attr("dy", 20)
          .attr("dx", indent + 5)
          .attr("x", 0);
        }

        expandMemberHolder.bind(this)(d, false, newG.node().getBBox().height+22);
      }


      function expandMemberHolder(d, showAll=true, offsetH = 0){
        let newG;
        if (showAll === true){
          newG = svgMG.append("g").attr("class", "new_g");
        } else {
          newG = svgSG.append("g").attr("class", "new_g");
        }


        if (this.members[d.name]){
          let sortIndex = 0;
          for (let tempA of this.members[d.name].keys()){
            if (showAll === true || this.membersFailed[d.name].includes(tempA)){
              let innerG = newG.append("g")
              .attr("sortIndex", sortIndex)
              .attr("expanded", "false")
              .attr("class", "member_g")
              .attr("y", 22+44*sortIndex + offsetH);

              let tt = innerG.append("text").text(tempA)
              .attr("sortIndex", sortIndex)
              .attr("y", 22+44*sortIndex + offsetH);

              if (this.membersFailed[d.name].includes(tempA)){
                tt.style("fill", "#FF0000");
              }

              innerG.on("click", expandMember.bind(this, d, innerG, tempA, newG, showAll));

              sortIndex++;
            }
          }

        } else if (!this.members[d.name]){
          newG.append("text").text("This node has no members.")
          .attr("dy", 20)
          .attr("dx", 5)
          .attr("x", 0);
        }

        if (showAll === true){
          let bbox = svgMG.node().getBBox();
          svgM.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
          .attr("width", (bbox.width+bbox.x))
          .attr("height", (bbox.height+bbox.y));
        } else {
          let bbox = svgSG.node().getBBox();
          svgS.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
          .attr("width", (bbox.width+bbox.x))
          .attr("height", (bbox.height+bbox.y));
        }

      }


      function expandMember(d, innerG, k, newG, showAll){
        let heightStart = innerG.node().getBBox().height;

        if (innerG.attr("expanded") == "false"){
          innerG.attr("expanded", "true");
          let textArray = [];
          let tempA = this.members[d.name].get(k)
          if (tempA.includes('\n')){
            for (let tempB of tempA.split('\n')){
              textArray.push(tempB);
            }
          } else {
            textArray.push(tempA);
          }


          innerG.select("text").text("");

          for (let textX of textArray){
            let indent = (textX.split('\t').length -1) * 20;
            innerG.select("text").append('tspan')
            .text(" " + textX)
            .attr("dy", 20)
            .attr("dx", indent + 5)
            .attr("x", 0);
          }

          if (showAll === false && this.node_validation[k]){
            textArray = this.node_validation[k].split('\n');

            //Empty line between member & report
            innerG.select("text").append('tspan')
            .text(" ")
            .attr("dy", 20)
            .attr("dx", 25)
            .attr("x", 0);

            for (let textX of textArray){
              let indent = (textX.split('\t').length -1) * 20;
              innerG.select("text").append('tspan')
              .text(" " + textX)
              .attr("dy", 20)
              .attr("dx", indent + 25)
              .attr("x", 0);
            }
          }


        } else {
          innerG.attr("expanded", "false");
          innerG.select("text").text(k);
          heightStart += 44;
        }

        let heightNew = innerG.node().getBBox().height - heightStart + 22;

        for(let tn of newG.selectAll(".member_g")){
          if (Number(d3.select(tn).attr("sortIndex")) > Number(innerG.attr("sortIndex"))){
            d3.select(tn).attr("y", heightNew + Number(d3.select(tn).attr("y")));
            d3.select(tn).selectAll("text").attr("y", d3.select(tn).attr("y"));

          }
        }

        if (showAll === true){
          let bbox = svgMG.node().getBBox();
          svgM.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
          .attr("width", (bbox.width+bbox.x))
          .attr("height", (bbox.height+bbox.y));
        } else {
          let bbox = svgSG.node().getBBox();
          svgS.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
          .attr("width", (bbox.width+bbox.x))
          .attr("height", (bbox.height+bbox.y));
        }
      }


      function expandRelationHolder(currentg, d){
        let newG = svgEG.append("g").attr("class", "new_g");
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

        for (let pAttr of this.nodeSpecial){
          if (d[pAttr]){
            tt.append("tspan").text(`${pAttr}:`)
            .attr("dy", 22)
            .attr("x",0)
            .attr("dx",5);
            for (const value of Object.values(d[pAttr])) {
              let textArray = JSON.stringify(value, null, '\t').split('\n');
              let regex = /^(\t*{\t*)|(\t*}\t*)|(\t*],*\t*)$/g;
              for (let textX of textArray){
                if (!textX.match(regex)){
                  let indent = (textX.split('\t').length -1) * 20;
                  tt.append('tspan')
                  .text(" " + textX.replace(': [',': '))
                  .attr("dy", 22)
                  .attr("dx", indent + 5)
                  .attr("x", 0);
                }

              }
            }
          }
        }

        let offH = tt.node().getBBox().height + 30;
        let innerg = newG.append("svg:foreignObject")
          .attr("x", 50)
          .attr("y", offH)
          .attr("width", 600)
          .attr("height", 600);

        var table = innerg.append('xhtml:table');
        var thead = table.append('thead');
        var	tbody = table.append('tbody').attr("id", "my_tbody");

        var tableData = [];
        var tableColumns = ["type", "value", "path"];

        for (let relX of this.jsondata[d.id]){
          let rowData = {};
          if(relX.type){
            rowData.type = (relX.type + "").split('#').pop() + ": "
          } else {
            rowData.type = "No Type"
          }

          if (relX.value){
            let tempV = ""
            for (let v of relX.value){
              tempV += v['@value'] + ", ";
            }
            rowData.value = tempV.slice(0,-2);
          } else {
            rowData.value = "No Value";
          }

          if (relX.path){
            let tempP = ""
            for (let v of relX.path){
              if(!v['@id']){
                tempP += 'Nested path, expand to view'
              } else {
                tempP += v['@id'];
              }
            }
            rowData.path = tempP;
          } else {
            rowData.path = "No Path";
          }
          tableData.push(rowData);
        }



        // append the header row
        thead.append('tr')
        .selectAll('th')
        .data(tableColumns).enter()
        .append('th')
        .text(function (column) { return column; });


        tbody = document.getElementById("my_tbody")

        let count = 0;
        for (let dataX of tableData){
          let trX = tbody.insertRow();
          trX.id = "small"+count;
          trX.onclick = tableClick.bind(this, count, this.jsondata[d.id][count].node[0]["@id"], newG, innerg, table, true)

          for(let valueX of Object.values(dataX)){
            let textX = document.createTextNode(valueX);
            let tdX = trX.insertCell();
            tdX.appendChild(textX);
          }

          trX = tbody.insertRow();
          trX.style.visibility = "collapse";
          trX.id = "large"+count;
          trX.onclick = tableClick.bind(this, count, this.jsondata[d.id][count].node[0]["@id"], newG, innerg, table, false)

          let textX = document.createTextNode(createExtraCell(this.jsondata[d.id][count]));

          let tdX = trX.insertCell();
          tdX.classList.add('spacing');
          tdX.colSpan = tableColumns.length;
          tdX.appendChild(textX);

          count++;
        }

        let bboxT = table.node();
        innerg.attr("width", bboxT.offsetWidth).attr("height", bboxT.offsetHeight);

        newG.selectAll(".inner_rect").attr("width", newG.node().getBBox().width+10);

        newG.append("rect").attr("x", 0).attr("y", 0).style("stroke", "#69b3a2")
        .attr("width", newG.node().getBBox().width+30)
        .attr("height", newG.node().getBBox().height+30)
        .attr("class", "outer_rect")
        .lower();

        newG.selectAll("text tspan").raise();




        // Make the main svg holding this large enough to show everything
        let bbox = svgEG.node().getBBox();
        svgE.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
        .attr("width", (bbox.width+bbox.x))
        .attr("height", (bbox.height+bbox.y));
      }



      function tableClick(index, url, newG, innerg, table, expand = true){
        if (window.event.ctrlKey) {
          this.getData(url);
          return;
        }

        if (expand === true){
          document.getElementById("large"+index).style.visibility = "visible";
          document.getElementById("small"+index).style.visibility = "collapse";
        } else {
          document.getElementById("small"+index).style.visibility = "visible";
          document.getElementById("large"+index).style.visibility = "collapse";
        }

        newG.selectAll(".outer_rect").attr("width", 0)
        .attr("height", 0);
        let bboxT = table.node();
        innerg.attr("width", bboxT.offsetWidth).attr("height", bboxT.offsetHeight);
        newG.selectAll(".inner_rect").attr("width", newG.node().getBBox().width+10);
        newG.selectAll(".outer_rect").attr("width", newG.node().getBBox().width+30)
        .attr("height", newG.node().getBBox().height+30);
        newG.selectAll("text tspan").raise();
        let bbox = svgEG.node().getBBox();
        svgE.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
        .attr("width", (bbox.width+bbox.x))
        .attr("height", (bbox.height+bbox.y));
      }



      function createExtraCell(relX){
        let textX = "";
        if (relX.type){
          textX += "type: " + relX.type + "\n";
        } else {
          textX += "Relation has no type" + "\n";
        }

        if (relX.value){
          for (let v of relX.value){
            if(!v['@value']){
              textX += "value: " + "\n";
              let textArray = JSON.stringify(v, null, '\t').split('\n');
              for (let textXX of textArray){
                textX += textXX + "\n";
              }
            } else {
              textX += "value: " + v['@value'] + "\n";
            }
          }
        } else {
          textX += "Relation has no value" + "\n";
        }


        if (relX.path){
          for (let v of relX.path){
            if(!v['@id']){
              textX += "path: " + "\n";
              let textArray = JSON.stringify(v, null, '\t').split('\n');
              for (let textXX of textArray){
                textX += textXX + "\n";
              }
            } else {
              textX += "path: " + v['@id'] + "\n";
            }
          }
        } else {
          textX += "Relation has no path" + "\n";
        }

        if (relX.node){
          for (let v of relX.node){
            textX += "node: " + v['@id'] + "\n";
          }
        } else {
          textX += "Relation has no node" + "\n";
        }


        if (relX.remainingItems){
          for (let v of relX.remainingItems){
            textX += "remainingItems: " + v['@value'] + "\n";
            if(v['@type']){
              textX += "remainingItemsType: " + v['@type'] + "\n";
            }
          }
        }

        for (let pAttr of this.relationSpecial){
          if (relX[pAttr]){
            textX += `${pAttr}:` + "\n";
            for (const value of Object.values(relX[pAttr])) {
              let textArray = JSON.stringify(value, null, '\t').split('\n');
              let regex = /^(\t*{\t*)|(\t*}\t*)|(\t*],*\t*)$/g;
              for (let textXX of textArray){
                if (!textX.match(regex)){
                  textX += textXX + "\n";
                }

              }
            }
          }
        }
        console.log(textX);
        return textX;
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
  height:75vh;
}

#windowContainer {
  position: fixed;
  top: 0;
  left: 0;
  background-color: rgba(255, 255, 255, 0.75);
  width: 100%;
  height: 100%;
  padding-top: 100px;
  display: none;
}

.container {
  margin-bottom: 10px;
  position: sticky;
  left: 0%;
}

.divFloat {
  margin: 0 auto;
  background-color: #FFF;
  color: #000;
  width: 600px;
  height: auto;
  padding: 20px;
  border: solid 1px #999;
  -webkit-border-radius: 3px;
  -webkit-box-orient: vertical;
  -webkit-transition: 200ms -webkit-transform;
  box-shadow: 0 4px 23px 5px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.15);
  display: block;
  resize: both;
  overflow:scroll;
}

.close {
  position: sticky;
  left: 100%;
  width: 20px;
  height: 20px;
  opacity: 0.3;
  float: right;
  z-index: 11;
}
.close:hover {
  opacity: 1;
}
.close:before, .close:after {
  position: absolute;
  top: -1px;
  content: ' ';
  height: 20px;
  width: 2px;
  background-color: #333;
}
.close:before {
  transform: rotate(45deg);
}
.close:after {
  transform: rotate(-45deg);
}
.spacing {
  white-space: pre;
}

svg{
  vertical-align: top;
}

rect {
  fill: white;
  stroke-width: 1.5px;
}

/* table {
  width: 600px;
  height: 600px;
} */

 table {
  /* width: 100%; */
  border-collapse: collapse;
}
tr:nth-of-type(odd) {
  background: #eee;
}
th {
  background: #333;
  color: white;
  font-weight: bold;
  cursor: s-resize;
  background-repeat: no-repeat;
      background-position: 3% center;
}
td, th {
  padding: 6px;
  border: 1px solid #ccc;
  text-align: left;
}

th.des:after {
    content: "\21E9";
  }

  th.aes:after {
    content: "\21E7";
  }

  th {
    text-align: right;
    font-weight: bold;
}

/* table {
    text-align: right;
    padding-right: 2px;
    margin-right: 3px;
    width: 100%;
}

td:nth-child(6) {
    margin-right: 8px;
}

td:nth-child(1) {
    width: 200px;
}  */
</style>
