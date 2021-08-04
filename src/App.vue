<template>
  <!-- <img alt="Vue logo" src="./assets/logo.png">
  <HelloWorld msg="Welcome to Your Vue.js App"/> -->

  <label for="width">Enter prefered graph width: </label>
  <input type="number" v-model="graph_width" placeholder="400" name="width"><br>

  <label for="height">Enter prefered graph height: </label>
  <input type="number" v-model="graph_height" placeholder="400" name="height"><br>

  <label for="url">Enter URL: </label>
  <input type="url" v-model="data_url" placeholder="URL" name="url"><br>

  <button v-on:click="getData">Draw Graph</button><br>

  <div id="my_dataviz" style="overflow:scroll"></div>

  <!-- <p>{{qtext}}</p> -->
  <p>{{jsondata}}</p>
  <!-- <p>{{memberIds}}</p> -->
</template>

<script>
// import HelloWorld from './components/HelloWorld.vue';
import rdfDereferencer from "rdf-dereference";
import 'setimmediate';
import * as d3 from "d3";
//import data from "./assets/data_network.json";
//import data2 from "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/data_network.json"
//import setimmediate from 'setimmediate';
const extractMetadata = require('@treecg/tree-metadata-extraction').extractMetadata


export default {
  name: 'App',
  components: {
    // HelloWorld
  },
  data(){
    return {
      qtext: [],
      jsondata: {"collection":[], "nodes":[], "relations":[], "links":[]},
      next_url: ""
    }
  },
  created(){
    // var scripts = [
    //   "https://d3js.org/d3.v7.min.js"
    // ];
    // scripts.forEach(script => {
    //   let tag = document.createElement("script");
    //   tag.setAttribute("src", script);
    //   document.head.appendChild(tag);
    // });

  },
  mounted(){
    //this.drawing();
  },
  // watch : {
  //   //next_url: function(){console.log(this.next_url)},//this.getData()}
  //   data_url: {
  //     deep: true,
  //     handle(val){
  //       console.log("test");
  //       console.log(this.data_url, val);
  //     }
  //   },
  //   next_url: {
  //     deep: true,
  //     handle(val){
  //       console.log("test");
  //       console.log(this.next_url, val);
  //     }
  //   }
  // },
//   watch: {
//   next_url: {
//     handler(newVal, oldVal) {
//       //console.log("test next_url")
//       //console.log(newVal, oldVal)
//       this.data_url = newVal;
//       this.getData();
//     },
//   }
// },
  methods : {
    async getData() {
      this.qtext = [];
      this.jsondata = {"collection":[], "nodes":[], "relations":[], "links":[]};
      console.log("TESTING:");
      var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/a.nt';
      if (this.data_url){
        standardURL = this.data_url;
      }
      console.log("standardURL: ", standardURL);
      const {quads} = await rdfDereferencer.dereference(standardURL);//'https://treecg.github.io/demo_data/stops.nt');//'http://dbpedia.org/page/12_Monkeys');
      quads.on('data', (quad) => {this.qtext.push(quad); /*console.log(quad)*/})
         .on('error', (error) => console.error(error))
         .on('end', () => {
           console.log('All done!');
           // quads is an array of RDF Quads (RDF.Quad[])
           extractMetadata(this.qtext).then(metadata => {
             console.log(metadata);
             for (var collectionId of metadata.collections.keys()) {
               var collectionObj = metadata.collections.get(collectionId);

               this.jsondata.collection.push({"id":collectionId, "name":collectionObj['@id'], "type":"collection", "vocab":collectionObj['@context']["@vocab"]});

               //TODO shape is an array, fix this with a for loop and make sure id's are different
               if (metadata.collections.get(collectionId).shape){
                 var count = 0;
                 //console.log(collectionObj.shape.length);
                 for (var shapeNode of collectionObj.shape){
                   console.log(shapeNode);
                   this.jsondata.collection.push({"id":collectionId+"shape"+count, "type":"shape"});
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

             for (var nodeId of metadata.nodes.keys()){
               var nodeObj = metadata.nodes.get(nodeId);
               for (var relation of nodeObj.relation){
                 this.jsondata.relations.push({"id":relation['@id'], "name":relation['@id'], "type":"relation"});
                 //Don't forget to add _node to the source id, else all relations will be linked to the collection not the node
                 this.jsondata.links.push({"source":nodeId+"_node", "target":relation['@id'], "name":"relation"});
               }
             }

            //console.log(this.jsondata.nodes);
             for (var relationJson of this.jsondata.relations){
               //console.log(relationJson.id);
               var relationObj = metadata.relations.get(relationJson.id);
               //console.log(relationObj);
               //console.log(nodeJson.id);
               //console.log(typeof(relationJson));
               //console.log(relationJson);

               //relationJson.push({"type":relationObj['@type']});
               relationJson.type = relationObj['@type'];
               //console.log(relationJson);
               relationJson.node = relationObj.node;
               relationJson.path = relationObj.path;
               relationJson.value = relationObj.value;
               relationJson.remainingItems = relationObj.remainingItems;

             }

             //console.log(this)

             // for (var relationId of metadata.relations.keys()){
             //   //console.log(relationId);
             //   var relation = metadata.relations.get(relationId);
             //
             // }
             //console.log(this.jsondata.relations.get("_:b2_Baa"))





               //this.jsondata.nodes.push({"id":collectionId, "name":metadata.collections.get(collectionId)['@id']})
            // Get the collection object
            //const collection = metadata.collections.get(collectionId)
              // Map the member URIs to extract the @id values
            //const memberURIs = collection.member.map(uri => uri["@id"])
              // Store the @id values
              //this.memberIds = this.memberIds.concat(memberURIs)

            this.drawing(metadata);

           })



           // Retrieve extracted collections metadata
           // for (const collectionId of metadata.collections.keys()) {
           //   const collection = metadata.collections.get(collectionId)
           // }
           //
           // // Retrieve extracted nodes metadata
           // for (const nodeId of metadata.nodes.keys()) {
           //   const node = metadata.nodes.get(nodeId)
           // }
           //
           // // Retrieve extracted relations metadata
           // for (const relationId of metadata.relations.keys()) {
           //   const relation = metadata.relations.get(relationId)
           // }

         });
    },
    drawing(metadata) {
      // set the dimensions and margins of the graph
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


      // append the svg object to the body of the page
      const svg = d3.select("#my_dataviz")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      //.attr("width", "101%")
      //.attr("height", "101%")
      .append("g")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      // .attr("transform",
      // `translate(${margin.left}, ${margin.top})`);

  //     const markerBoxWidth = 20;
  //     const markerBoxHeight = 20;
  //     const refX = markerBoxWidth / 2;
  //     const refY = markerBoxHeight / 2;
  //     //const markerWidth = markerBoxWidth / 2;
  //     //const markerHeight = markerBoxHeight / 2;
  //     const arrowPoints = [[0, 0], [0, 20], [20, 10]];
  //
  //     svg
  // .append('defs')
  // .append('marker')
  // .attr('id', 'arrow')
  // .attr('viewBox', [0, 0, markerBoxWidth, markerBoxHeight])
  // .attr('refX', refX)
  // .attr('refY', refY)
  // .attr('markerWidth', markerBoxWidth)
  // .attr('markerHeight', markerBoxHeight)
  // .attr('orient', 'auto-start-reverse')
  // .append('path')
  // .attr('d', d3.line()(arrowPoints))
  // .attr('stroke', 'black');

  //arrows
// svg.append('svg:defs').append('svg:marker')
// .attr('id', 'arrow').attr('viewBox', '0 0 10 10')
// .attr('refX', 0).attr('refY', 5)
// .attr('markerUnits', 'strokeWidth')
// .attr('markerWidth', 8)
// .attr('markerHeight', 6)
// .attr('orient', 'auto')
// .append('svg:path')
// .attr('d', 'M 0 0 L 10 5 L 0 10 z');
//
//
// svg.append("line")
// .attr('x1', 5)
// .attr('x2', 50)
// .attr('y1', 5)
// .attr('y2', 50)
// .style('stroke', 'black')
// .attr('stroke-width', 2)
// .attr('marker-end', 'url(#arrow)');


//TODO find a way to make the arrowhead placed dynamically instead of using refX
var marker=
svg.append("marker")
//.attr("id", function(d) { return d; })
.attr("id", "resolved")
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

console.log(marker);



      const tooltipdiv = d3.select("#my_dataviz").append("div")
      .attr("class", "tooltip")
      .style("opacity", 0)
      .style("position", "absolute");

      //console.log(JSON.parse(JSON.stringify(data_network)));
      //d3.json(data_network).then(function(data){ console.log(data)});

      //d3.json("http url ding").then( function( data) {

        // Initialize the links
        // const link = svg
        // .selectAll("line1")
        // .data(this.jsondata.links)
        // .join("line")
        // .style("stroke", "#aaa")


        const link = svg.selectAll(".edgepath")
            .data(this.jsondata.links)
            .enter()
            .append("path")
            .style("stroke","gray")
            .style("pointer-events", "none")
        .style("stroke-width",0.5)//line thickness
        .attr("marker-end", "url(#resolved)" );//Mark the arrow according to the id number of the arrow mark

//         const link = svg.selectAll("line")
// .data(this.jsondata.links).enter().append('g').attr('class', 'node')
// .append('line')
// .attr('class','path')
// .style('stroke-width', 2)
// .attr('marker-end', 'url(#arrow)');


  //       svg
  // .append('path')
  // .attr('d', link)
  // .attr('marker-end', 'url(#arrow)')
  // .attr('stroke', 'black')
  // .attr('fill', 'none');


        // Initialize the nodes
        const node = svg
        .selectAll("circle1")
        .data(this.jsondata.nodes)
        .join("ellipse")
        .attr("rx", 60)
        .attr("ry", 20)
        .style("fill", "#69b3a2")
        .on("mouseover", function(d, i) {
            tooltipdiv.transition()
                .duration(200)
                .style("opacity", .9);
            tooltipdiv.html(i.name)
              .style("left", d.x + 2 + window.pageXOffset + "px")
              .style("top", d.y + 2 + window.pageYOffset + "px");
              //console.log(d,i);
              //console.log(document.documentElement.scrollTop);
              //console.log(document.documentElement.scrollLeft);
                // .style("left", (d3.event.pageX) + "px")
                // .style("top", (d3.event.pageY - 28) + "px");
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
        .join("ellipse")
        .attr("rx", 60)
        .attr("ry", 20)
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

        const relation = svg
        .selectAll("circle3")
        .data(this.jsondata.relations)
        .join("ellipse")
        .attr("rx", 90)
        .attr("ry", 20)
        .attr("class", "relation")
        .style("fill", "#6562cc")
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
        .on("click", clickNext.bind(this))
        //.call(drag);
        .call(d3.drag()
        .on("start", dragstartX)
        .on("end", dragendX)
        .on("drag", dragX)
      );
      // .enter().append('text')
      // .attr("text-anchor", "middle")
      // .text(function(d) {
      //   return (d.type + "").split('#').pop()
      // });
        // .on("drag", function(d) {console.log("drag"); dragX(event, d)})
        // .on("dragstart", function() {console.log("dragstart");dragstartX()})
        // .on("dragend", function() {console.log("dragend");dragendX()});

        console.log(metadata);

        function clickNext(d,i){
          //console.log(d,i);
          //console.log(i.id);
          // if(i.node){
          //   console.log(i.node);
          // }

          //TODO make this a better error
          if (metadata.relations.get(i.id).node.length != 1){
            console.log("ERROR: this relation has multiple node url's defined!", metadata.relations.get(i.id).node);
          }
          //console.log(metadata.relations.get(i.id).node[0]['@id']);
          //console.log(window);

          // console.log(this.next_url);
          // this.next_url = metadata.relations.get(i.id).node[0]['@id'];
          // console.log("blups", this.next_url);

          console.log(metadata.relations.get(i.id).node[0]['@id']);
          this.data_url = metadata.relations.get(i.id).node[0]['@id'];
          d3.selectAll(".tooltip").remove();
          this.getData();

          // for (var ding of metadata.relations.get(i.id).node){
          //   console.log(ding.key());
          // }
          //console.log(metadata.relations.get(i.id).node);
          //console.log(this.metadata.relations.get(i.id));
        }


        var all = this.jsondata.nodes.concat(this.jsondata.relations.concat(this.jsondata.collection));

        // const bubblesText = svg
        // .selectAll('bubbleText1')
        // .data(all, function(d) {
        //   return d.id;
        // });
        //
        // bubblesText.enter().append('text')
        // .attr("text-anchor", "middle")
        // // .classed('bubble', true)
        // .text(function(d) {
        //   return d.type
        // });


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



        //.call(drag(simulation));

        // Let's list the force we want to apply on the network

        const simulation = d3.forceSimulation(all)                 // Force algorithm is applied to data.nodes
        .force("link", d3.forceLink()                               // This force provides links between nodes
        .id(function(d) { return d.id; })                     // This provide  the id of a node
        .links(this.jsondata.links)                                    // and this the list of links
       )
      //.force("charge", d3.forceManyBody().strength(-800))         // This adds repulsion between nodes. Play with the -400 for the repulsion strength
      //.force("center", d3.forceCenter(width / 2, height / 2))     // This force attracts nodes to the center of the svg area
      //.on("end", ticked);

      d3.forceSimulation(all)
          .force("charge", d3.forceManyBody().strength(-400))

      d3.forceSimulation(this.jsondata.collection.concat(this.jsondata.nodes))
          .force("charge", d3.forceManyBody().strength(-800))

    d3.forceSimulation(this.jsondata.collection.concat(this.jsondata.relations))
        .force("charge", d3.forceManyBody().strength(-2000))

        d3.forceSimulation(this.jsondata.nodes)
      .force("center", d3.forceCenter(width / 2, height / 2))

    //   d3.forceSimulation(this.jsondata.nodes)
    //       // Force algorithm is applied to data.nodes
    //       .force("charge", d3.forceManyBody().strength(-800))
    // .force("center", d3.forceCenter(width / 2, height / 2))     // This force attracts nodes to the center of the svg area
    //.on("end", ticked);

    d3.forceSimulation(this.jsondata.relations)
  .force("charge", d3.forceManyBody().strength(-3000))
  .on("end", ticked);

      console.log(simulation);

      // const drag = d3.behavior.drag()
      // drag.on('drag', function(d) {
      //     let mousePos = mouse(this);
      //     node.x = mousePos[0];
      //     node.y = mousePos[1];
      //     console.log(d)
      //     update();
      // });

      // This function is run at each iteration of the force algorithm, updating the nodes position.
      function ticked() {
        console.log("fixing layout done (why is this so slow?)");
        // link
        // .attr("x1", function(d) { return d.source.x; })
        // .attr("y1", function(d) { return d.source.y; })
        // .attr("x2", function(d) { return d.target.x; })
        // .attr("y2", function(d) { return d.target.y; });

        link.attr('d', function(d) {
            var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
            return path;
        });

        node
        .attr("cx", function(d) { return d.x+6; })
        .attr("cy", function(d) { return d.y-6; });

        relation
        .attr("cx", function(d) { return d.x+6; })
        .attr("cy", function(d) { return d.y-6; });

        collection
        .attr("cx", function(d) { return d.x+6; })
        .attr("cy", function(d) { return d.y-6; });

        bubblesText
        .attr('x', function(d) { return d.x+6; })
        .attr('y', function(d) { return d.y-6; });
      }




  function dragstartX() {
    d3.select(this).attr("stroke", "black");
  }

  function dragX(event, d) {
    d3.select(this).attr("cx", d.x = event.x).attr("cy", d.y = event.y);
    link.attr('d', function(d) {
        var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
        return path;
    });
    bubblesText
    .attr('x', function(d) { return d.x; })
    .attr('y', function(d) { return d.y; });
  }

  function dragendX() {
    d3.select(this).attr("stroke", null);
    link.attr('d', function(d) {
        var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
        return path;
    });
    bubblesText
    .attr('x', function(d) { return d.x; })
    .attr('y', function(d) { return d.y; });
  }


      // Create Event Handlers for mouse
      // function handleMouseOver(d, i) {  // Add interactivity
      //     console.log(d, i);
      //
      //       // Use D3 to select element, change color and size
      //       // d3.select(this).attr({
      //       //   fill: "orange",
      //       //   // r: radius * 2
      //       // });
      //
      //       // Specify where to put label of text
      //       // svg.append("text").attr({
      //       //    id: "t" + d.x + "-" + d.y + "-" + i,  // Create an id for text so we can select it later for removing on mouseout
      //       //     x: function() { return xScale(d.x) - 30; },
      //       //     y: function() { return yScale(d.y) - 15; }
      //       // })
      //       // .text(function() {
      //       //   return [d.x, d.y];  // Value of the text
      //       // });
      //       console.log("t" + d.x + "-" + d.y + "-" + i.id);
      //       // svg.append("text").attr({
      //       //   id: "t" + d.x + "-" + d.y + "-" + i.id,
      //       //   x: function(){ return d.x},
      //       //   y: function(){ return d.y}
      //       // })
      //       svg.append("text").attr({
      //         'x': d.x,
      //         'y': d.y
      //       })
      //       .text(function(){
      //         return [i.name];
      //       });
      //     }
      //
      // function handleMouseOut(d, i) {
      //   console.log(d, i);
      //       // Use D3 to select element, change color back to normal
      //       // d3.select(this).attr({
      //       //   fill: "black",
      //       //   // r: radius
      //       // });
      //
      //       // Select text by id and then remove
      //       d3.select("#t" + d.x + "-" + d.y + "-" + i.id).remove();  // Remove text location
      //     }

    //});
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
