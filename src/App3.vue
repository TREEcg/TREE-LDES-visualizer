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

      var all = this.jsondata.nodes.concat(this.jsondata.relations.concat(this.jsondata.collection.concat(this.jsondata.shapes)));



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



      const tooltipdiv = d3.select("#my_dataviz").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute");



      const link = svg.selectAll(".edgepath")
      .data(this.jsondata.links)
      .enter()
      .append("path")
      .style("stroke","gray")
      .style("pointer-events", "none")
      .style("stroke-width",0.5)//line thickness
      .attr("marker-end", "url(#arrow)" );



      // Initialize the nodes

      const node = svg
      .append("g")
      .selectAll("circle1")
      .data(this.jsondata.nodes)
      .join("rect")
      .attr("width", 60)
      .attr("height", 20)
      .style("fill", "#69b3a2")
      .on("mouseover", function(d, i) {
        tooltipdiv.transition()
        .duration(200)
        .style("opacity", .9);
        tooltipdiv.html(i.name)
        .style("left", d.x + 2 + window.pageXOffset + "px")
        .style("top", d.y + 2 + window.pageYOffset + "px");
      })
      .on("mouseout", function() {
        tooltipdiv.transition()
        .duration(500)
        .style("opacity", 0);
      })
      .call(d3.drag()
      .on("start", dragstartX)
      .on("end", dragendX)
      .on("drag", dragX)
    );

    const collection = svg
    .selectAll("circle2")
    .data(this.jsondata.collection)
    .join("rect")
    .attr("width", 60)
    .attr("height", 20)
    .style("fill", "#5fd145")
    .on("mouseover", function(d, i) {
      tooltipdiv.transition()
      .duration(200)
      .style("opacity", .9);
      tooltipdiv.html(i.name)
      .style("left", d.x + 2 + window.pageXOffset + "px")
      .style("top", d.y + 2 + window.pageYOffset + "px");
    })
    .on("mouseout", function() {
      tooltipdiv.transition()
      .duration(500)
      .style("opacity", 0);
    })
    .call(d3.drag()
    .on("start", dragstartX)
    .on("end", dragendX)
    .on("drag", dragX)
  );

  const shapes = svg
  .selectAll("circle2")
  .data(this.jsondata.shapes)
  .join("rect")
  .attr("width", 60)
  .attr("height", 20)
  .style("fill", "#5e915a")
  .on("mouseover", function(d, i) {
    tooltipdiv.transition()
    .duration(200)
    .style("opacity", .9);
    tooltipdiv.html(i.name)
    .style("left", d.x + 2 + window.pageXOffset + "px")
    .style("top", d.y + 2 + window.pageYOffset + "px");
  })
  .on("mouseout", function() {
    tooltipdiv.transition()
    .duration(500)
    .style("opacity", 0);
  })

  .on("click", function(d, i){

    if (d3.select(this).attr("width")==60){

      for (let temp of d3.selectAll('.bubbleText')._groups.pop()){

        //TODO fix indent, fix height being changed incorrectly when dragged
        if (temp['__data__'].id == i.id){

          temp.textContent = "";

          let textArray = JSON.stringify(temp['__data__'].shape_extra, null, '\t').split('\n');
          d3.select(temp).attr("text-anchor","start");

          //Use odd number so it can't ever be exactly 60 again
          let offset = (31 + 20*textArray.length);

          //d3.select(temp).attr("y", startingY - offset/2);
          //console.log(d3.select(temp).attr("y"));


          d3.select(this).attr("height", offset).attr("width", 200);

          ticked();

          let startingX = d3.select(this).attr("x");
          let startingY = d3.select(this).attr("y");
          //console.log(startingY);

          for (let t of textArray){
            d3.select(temp).append('tspan').text(t).attr("dy", 20).attr("x", startingX);
          }

          d3.select(temp).attr("y", startingY);
          console.log(startingY);
          console.log(d3.select(temp));

        }
      }
    } else {
      d3.select(this).attr("width", 60).attr("height", 20);
      for (let temp of d3.selectAll('.bubbleText')){
        if(temp['__data__'].id == i.id){
          d3.select(temp).attr("text-anchor","middle");
          temp.textContent = temp['__data__'].type;
          ticked();
        }
      }
    }
  })
  .call(d3.drag()
  .on("start", dragstartX)
  .on("end", dragendX)
  .on("drag", dragX)
);

const bubblesText = svg
.selectAll('bubbleText1')
.data(all, function(d) {
  return d.id;
})
.enter().append('text')
.attr("text-anchor", "middle")
.attr("class", "bubbleText")
.text(function(d) {
  return (d.type + "").split('#').pop()
});

//const simulation =
d3.forceSimulation(all)
.force("link", d3.forceLink()
.id(function(d) { return d.id; })
.links(this.jsondata.links)
)


d3.forceSimulation(all)
  .force("charge", d3.forceManyBody().strength(-400))

d3.forceSimulation(this.jsondata.collection.concat(this.jsondata.nodes.concat(this.jsondata.shapes)))
  .force("charge", d3.forceManyBody().strength(-800))

d3.forceSimulation(this.jsondata.collection.concat(this.jsondata.relations.concat(this.jsondata.shapes)))
.force("charge", d3.forceManyBody().strength(-2000))

d3.forceSimulation(this.jsondata.nodes)
.force("center", d3.forceCenter(width / 2, height / 2))


d3.forceSimulation(this.jsondata.relations)
.force("charge", d3.forceManyBody().strength(-3000))
.alphaDecay(this.alpha_decay_rate)
.on("end", ticked);

//console.log(simulation);


function ticked() {

link.attr('d', function(d) {
    var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
    return path;
});

node
.attr("x", function(d) { return d.x - d3.select(this).attr("width")/2; })
.attr("y", function(d) { return d.y - d3.select(this).attr("height"); });
/*
relation
.attr("x", function(d) { return d.x - d3.select(this).attr("width")/2; })
.attr("y", function(d) { return d.y - d3.select(this).attr("height"); });
*/

collection
.attr("x", function(d) { return d.x - d3.select(this).attr("width")/2; })
.attr("y", function(d) { return d.y - d3.select(this).attr("height"); });

shapes
.attr("x", function(d) { return d.x - d3.select(this).attr("width")/2; })
.attr("y", function(d) { return d.y - d3.select(this).attr("height"); });

bubblesText
.attr('x', function(d) { console.log("this:");console.log(d3.select(this));console.log("d:");console.log(d3.select(d));return d.x+6; })
.attr('y', function(d) { return d.y-6; });
}




function dragstartX() {
d3.select(this).attr("stroke", "black");
}

function dragX(event, d) {
d3.select(this).attr("x", d.x = event.x).attr("y", d.y = event.y);
ticked();
}

function dragendX() {
d3.select(this).attr("stroke", null);
ticked();
}







}
}
}

</script>
