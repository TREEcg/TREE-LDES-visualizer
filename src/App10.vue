<template>

  <p>Click a bubble to show all attributes</p>
  <p>ctrl+click a relation to navigate to the node</p>

  <label for="adecay">Enter graph convergence speed, between 0 and 1</label>
  <input type="number" v-model="alpha_decay_rate" placeholder="0.023" name="adecay"><br>

  <label for="width">Enter prefered graph width: </label>
  <input type="number" v-model="graph_width" placeholder="400" name="width"><br>

  <label for="height">Enter prefered graph height: </label>
  <input type="number" v-model="graph_height" placeholder="400" name="height"><br>

  <label for="url">Enter URL: </label>
  <input type="url" v-model="data_url" placeholder="URL" name="url"><br>

  <button v-on:click="getData(undefined)">Draw Graph</button><br>

  <div id="my_dataviz" style="overflow:scroll"></div>

  <div id="extra" style="overflow:scroll"></div>

  <p>{{jsondata}}</p>

</template>


<script>

import rdfDereferencer from "rdf-dereference";
import 'setimmediate';
import * as d3 from "d3";
const extractMetadata = require('@treecg/tree-metadata-extraction').extractMetadata

export default {
  name: 'App',
  components: {
  },
  data(){
    return {
      qtext: [],
      jsondata: {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[], "relations_holder":[]},
      svgHolder: null,
      next_url: "",
      checked_shape: false,
      graph_height: 600,
      graph_width: 1000,
      data_url: null,
      alpha_decay_rate: 0.5//1 - Math.pow(0.001, 1 / 300)
    }
  },
  methods : {
    async getData(url) {
      //TODO is it possible to keep all quads, extract all metadata and then not have to check for doubles?
      //Simply by removing all doubles from the saved quads?

      //Need to clear the data before redrawing
      this.qtext = [];


      //console.log("TESTING:");
      //var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/a.nt';
      var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/.root.nt'
      // if (this.data_url){
      //   standardURL = this.data_url;
      // }
      if(url){
        standardURL = url;
      } else if (this.data_url){
        standardURL = this.data_url;
        // This means user gave an url for a new collection so we need to clear whatever data we already had
        this.jsondata = {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[], "relations_holder":[]};
        d3.select("#extra").selectAll("g").remove();
        this.svgHolder = null;
      }
      //console.log("standardURL: ", standardURL);
      const {quads} = await rdfDereferencer.dereference(standardURL);//'https://treecg.github.io/demo_data/stops.nt');//'http://dbpedia.org/page/12_Monkeys');
      quads.on('data', (quad) => {this.qtext.push(quad); /*console.log(quad)*/})
      .on('error', (error) => console.error(error))
      .on('end', () => {
        //console.log('All done!');
        // quads is an array of RDF Quads (RDF.Quad[])
        extractMetadata(this.qtext).then(metadata => {
          console.log(metadata);

          if (metadata.collections.keys().length > 1){
            let errorText = "";
            errorText += "ERROR: found multiple collection! This is not allowed.";
            errorText += metadata.collections.keys();
            alert(errorText);
          }
          for (var collectionId of metadata.collections.keys()) {
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

              this.jsondata.collection.push({"id":collectionId, "name":collectionObj['@id'], "type":"collection", "vocab":collectionObj['@context']["@vocab"]});

              if (metadata.collections.get(collectionId).shape){
                var count = 0;
                for (var shapeNode of collectionObj.shape){
                  this.jsondata.shapes.push({"id":collectionId+"shape"+count, "type":"shape", "shape_extra":shapeNode});
                  this.jsondata.links.push({"source":collectionId, "target":collectionId+"shape"+count, "name":"shape"});
                  count++;
                }

              }

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
                  this.jsondata.nodes.push({"id":viewNode['@id']+"_node", "type":"Node", "name":viewNode['@id'], "relation_count":metadata.nodes.get(viewNode['@id']).relation.length, "offsetX": this.jsondata.nodes.length});
                  // this.jsondata.links.push({"source":collectionId, "target":viewNode['@id']+"_node", "name":"view"});
                  this.jsondata.relations_holder.push({"id":viewNode['@id']+"_node", "node_id":viewNode['@id']+"_node", "name":viewNode['@id'], "relation_count":metadata.nodes.get(viewNode['@id']).relation.length, "offsetX": this.jsondata.relations_holder.length})
                  // this.jsondata.links.push({"source":viewNode['@id']+"_node", "target":viewNode['@id']+"_relation_holder", "name":"relation_holder"});
                  this.jsondata.links.push({"source":collectionId, "target":viewNode['@id']+"_node", "name":"relation_holder"});
                }
              }
            } else {
              alert("Did not find any nodes linked to this url");
            }

            //TODO add member check and visualisation
            //TODO don't forget to remove old members on adding new ones?

          }


          //This does not need a duplicate check since old node relations won't be included in the new metadata
          //or they will just overwrite with the exact same data as was already present
          for (var nodeId of metadata.nodes.keys()){
            var nodeObj = metadata.nodes.get(nodeId);
            this.jsondata[nodeId+"_node"] = [];
            for (var relation of nodeObj.relation){
              this.jsondata[nodeId+"_node"].push({"id":relation['@id'], "node_id":nodeId+"_node", "name":relation['@id'], "type":"relation"});
              //Don't forget to add _node to the source id, else all relations will be linked to the collection not the node
              //this.jsondata.links.push({"source":nodeId+"_node", "target":relation['@id'], "name":"relation"});
            }
          }

          let tempN = [];
          for (let relationNode of this.jsondata.relations_holder){
            //This will hold all newly added nodes to later check if they confirm to any already existing relations
            tempN.push(relationNode.id);
            for (var relationJson of this.jsondata[relationNode.id]){
              if (metadata.relations.get(relationJson.id)){



                var relationObj = metadata.relations.get(relationJson.id);
                this.jsondata.relations.push({"source":relationNode.id, "target":relationObj.node[0]['@id']+"_node"});
                relationJson.type = relationObj['@type'];
                relationJson.node = relationObj.node;
                relationJson.path = relationObj.path;
                relationJson.value = relationObj.value;
                relationJson.remainingItems = relationObj.remainingItems;

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

          console.log("jsondata:");
          console.log(this.jsondata);

          this.drawing(metadata);

        })
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
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("svg")
        .attr("pointer-events", "all");
      }
      const svgE = this.svgHolder;



      const svgEG = svgE.append("g");



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
        d3.selectAll(".main_g")
        .attr("transform", function(){return "translate("+(e.transform.x- d3.select("svg").attr("prevTX"))+","+(e.transform.y- d3.select("svg").attr("prevTY"))+")scale("+e.transform.k+")"});

        fixLinks();
        link.attr("transform", function(){return "translate("+(e.transform.x- d3.select("svg").attr("prevTX"))+","+(e.transform.y- d3.select("svg").attr("prevTY"))+")scale("+e.transform.k+")"});
      });

      // At the end of a zoom we only keep scale attribute and calculate the correct x and y attributes based of the translation
      zoom.on("end", function(e) {

        d3.selectAll(".main_g")
        .attr("transform", function(){return "scale("+e.transform.k+")"})
        .attr("x", function(d) { d.x += e.transform.x - d3.select("svg").attr("prevTX")})
        .attr("y", function(d) { d.y += e.transform.y - d3.select("svg").attr("prevTY")})

        svg.attr("prevTX", e.transform.x).attr("prevTY", e.transform.y).attr("scaleAll", e.transform.k);

        fixGroupChildren()

        fixLinks();

      });

      // connect the zoom function to the main svg element
      svg.call(zoom);


      function clickRelationHolder(event, d){
        if (event.ctrlKey) {
          //TODO what if node data is wrong, multiple urls, etc?
          console.log("clicked w ctrl");
          console.log(d3.select(event.target).attr("node_link"));
          this.getData(d3.select(event.target).attr("node_link"));
        } else {

          let currentg = d3.select(event.target.parentNode);
          //currentg could be tspan parent = text and not the group
          if (!currentg.classed("relation_holder_g")){
            currentg = d3.select(currentg._groups[0][0].parentNode);
          }

          expandRelationHolder.bind(this)(currentg, d);

          ticked();

        }

      }


      function clickShape(event, d){
        let currentg = d3.select(event.target.parentNode);
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
          for(let temp of this.jsondata.shapes){
            if (temp.id == d.id){
              temp.expanded = "false";
            }
          }
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
        for(let temp of this.jsondata.shapes){
          if (temp.id == d.id){
            temp.expanded = "true";
          }
        }

        currentg.raise();

        let textArray = JSON.stringify(d.shape_extra, null, '\t').split('\n');

        currentg.select("rect")
        .attr("height", 10 + 20*textArray.length)

        currentg.select("text").text("");

        let prevIndent = 0;
        let sortIndex = 0;
        for (let textX of textArray){
          let indent = (textX.split('\t').length -1) * 4;
          currentg.select("text").append('tspan')
          .text(textX.replace('\t',''))
          .attr("dy", 20)
          .attr("dx", indent-prevIndent + 5)
          .attr("sortIndex", sortIndex);
          prevIndent = indent-prevIndent;
          sortIndex++;
        }

        currentg.select("text").selectAll("text, tspan")
        .attr("x", function(d) {return d.x;})

        currentg.select("rect").attr("width", currentg.node().getBBox().width + 10);
      }


      function expandRelationHolder(currentg, d){
        svgEG.selectAll("g").remove();

        expandRelationHolderTrue.bind(this)(currentg, d);
      }


      function expandRelationHolderTrue(currentg, d){

        let sortIndex = -1;
        let offsetY = Number(currentg.select("rect").attr("height"));

        let colors = ["#706ec4", "#7977d9"]

        let newG = svgEG.append("g").attr("class", "new_g new_g"+(d.id.replaceAll('.','').replaceAll(':','').replaceAll('/','')))
        .attr("x", d.offsetX)
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

          let textX = (relX.type + "").split('#').pop() + ": "
          for (let v of relX.value){
            textX += v['@value'] + ", ";
          }
          for (let v of relX.path){
            if(!v['@id']){
              textX += 'Object'
            } else {
              textX += v['@id']//(v['@id'] + "").split("/").pop();
            }
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
        if (!e.ctrlKey){
          e.stopPropagation();

          let currentg = e.target;
          while(!d3.select(currentg).classed("relation_g")){
            currentg = currentg.parentNode;
          }

          console.log(d3.select(currentg).attr("sortIndex"));

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
            tt.append("tspan").text("type: " + relX.type);

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

            for (let v of relX.node){
              tt.append("tspan").text("node: " + v['@id']);
            }

            for (let v of relX.remainingItems){
              tt.append("tspan").text("remainingItems: " + v['@value']);
              if(v['@type']){
                tt.append("tspan").text("remainingItemsType: " + v['@type']);
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
  margin-top: 60px;
}

svg{
  overflow: scroll;
}

g{
  overflow: scroll;
}
</style>
