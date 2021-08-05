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

  <button v-on:click="getData">Draw Graph</button><br>

  <div id="my_dataviz" style="overflow:scroll"></div>

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
      jsondata: {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[]},
      next_url: "",
      checked_shape: false,
      graph_height: 2000,
      graph_width: 2000,
      data_url: null,
      alpha_decay_rate: 0.5//1 - Math.pow(0.001, 1 / 300)
    }
  },
  methods : {
    async getData() {
      this.qtext = [];
      this.jsondata = {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[]};
      //console.log("TESTING:");
      var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/a.nt';
      if (this.data_url){
        standardURL = this.data_url;
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
          for (var collectionId of metadata.collections.keys()) {
            var collectionObj = metadata.collections.get(collectionId);

            this.jsondata.collection.push({"id":collectionId, "name":collectionObj['@id'], "type":"collection", "vocab":collectionObj['@context']["@vocab"]});

            //TODO shape is an array, fix this with a for loop and make sure id's are different
            if (metadata.collections.get(collectionId).shape){
              var count = 0;
              for (var shapeNode of collectionObj.shape){
                this.jsondata.shapes.push({"id":collectionId+"shape"+count, "type":"shape", "shape_extra":shapeNode});
                this.jsondata.links.push({"source":collectionId, "target":collectionId+"shape"+count, "name":"shape_TOBECHANGED"});
                count++;
              }

              // TODO Need to find a way to show actual shape data later
              // Maybe allow user to click on shape buble and simply show shape in text form in a new screen?

            }

            //TODO if there is no view there should probably be an error shown
            if (collectionObj.view){
              for (var viewNode of collectionObj.view){
                //Change the id to include _node because collection and main view can have the same URI
                //We do still want to show them as two separate nodes even though they are the same thing
                this.jsondata.nodes.push({"id":viewNode['@id']+"_node", "type":"Node", "name":viewNode['@id']});
                this.jsondata.links.push({"source":collectionId, "target":viewNode['@id']+"_node", "name":"view"});
              }
            }

            //TODO add member check and visualisation

          }

/*
          for (var nodeId of metadata.nodes.keys()){
            var nodeObj = metadata.nodes.get(nodeId);
            for (var relation of nodeObj.relation){
              this.jsondata.relations.push({"id":relation['@id'], "name":relation['@id'], "type":"relation"});
              //Don't forget to add _node to the source id, else all relations will be linked to the collection not the node
              this.jsondata.links.push({"source":nodeId+"_node", "target":relation['@id'], "name":"relation"});
            }
          }

          for (var relationJson of this.jsondata.relations){
            var relationObj = metadata.relations.get(relationJson.id);
            relationJson.type = relationObj['@type'];
            relationJson.node = relationObj.node;
            relationJson.path = relationObj.path;
            relationJson.value = relationObj.value;
            relationJson.remainingItems = relationObj.remainingItems;

          }
*/

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

      d3.selectAll("svg").remove();

      //var all = this.jsondata.nodes.concat(this.jsondata.relations.concat(this.jsondata.collection.concat(this.jsondata.shapes)));
      var all = this.jsondata.nodes.concat(this.jsondata.collection.concat(this.jsondata.shapes));



      // append the svg object to the body of the page
      const svg = d3.select("#my_dataviz")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)



      //TODO find a way to make the arrowhead placed dynamically instead of using refX
      //var marker=
      svg.append("marker")
      //.attr("id", function(d) { return d; })
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


      const collection = svg
      .selectAll("gcoll")
      .data(all)
      .join("g")
      .attr("class", "collection_g")


      collection.append("rect")
      .attr("class", "collection_rect")
      .attr("width", 80)
      .attr("height", 30)
      .style("fill", "#5fd145");

      collection.append("text")
      .attr("text-anchor", "start")
      .attr("class", "collection_text")
      .attr("dy",20)
      .text(function(d) {
        return (d.type + "").split('#').pop()
      })
      .raise();



      // const collectionG = svg
      // .selectAll("coll")
      // .data(all)
      // .join("rect")
      // .attr("width", 60)
      // .attr("height", 20)
      // .style("fill", "#69b3a2")
      // .append("text")
      // .text("TEST");

      d3.forceSimulation(all)
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("charge", d3.forceManyBody().strength(-400))
      .alphaDecay(this.alpha_decay_rate)
      .on("end", ticked);
      console.log(d3.selectAll(".collection_g"));

      function ticked() {
        console.log("ticked");
        //console.log(d3.selectAll(".collection_g"));
        // console.log(d3.selectAll("g"))
        // console.log(d3.selectAll(".collection_rect"))
        // collection
        // .attr("x", function(d) { return d.x })//- d3.select(this).attr("width")/2; })
        // .attr("y", function(d) { return d.y });//- d3.select(this).attr("height"); });
        d3.selectAll(".collection_g")
        .attr("x", function(d) { return d.x })//- d3.select(this).attr("width")/2; })
        .attr("y", function(d) { return d.y })
        .attr("transform", function(d){return "translate("+d.x+","+d.y+")"});
        //.attr("transform"="translate(x,y)");//- d3.select(this).attr("height"); });
        // .attr("x", function() { return this.x - d3.select(this).attr("width")/2; })
        // .attr("y", function() { return this.y - d3.select(this).attr("height"); });

        // d3.selectAll("c")
        // .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
      }

    }

  }

}

</script>
