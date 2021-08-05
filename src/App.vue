<template>
  <!-- <img alt="Vue logo" src="./assets/logo.png">
  <HelloWorld msg="Welcome to Your Vue.js App"/> -->

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

  <!-- <label for="checkbox_shape">Show shape information</label>
  <input type="checkbox" id="checkbox_shape" v-model="checked_shape">

  <div v-if="checked_shape" style="text-align:center">
    <div v-if="shape_info.length === 0" style="text-align:center">
      <p>No shape specified!</p>
    </div>
    <div v-else style="text-align:center">
      <p>{{this.shape_info}}</p>
    </div>
  </div> -->



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
//import * as d3 from 'd3-jetpack';
//const d3J = require('d3-jetpack');
//import data from "./assets/data_network.json";
//import data2 from "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/data_network.json"
//import setimmediate from 'setimmediate';
const extractMetadata = require('@treecg/tree-metadata-extraction').extractMetadata
// import { textwrap } from 'd3-textwrap';


export default {
  name: 'App',
  components: {
    // HelloWorld
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
    prettyJ(json) {
      if (typeof json !== 'string') {
        json = JSON.stringify(json, undefined, 2);
      }
      return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[ eE][+\\-]?\d+)?)/g,
      function (match) {
        let cls = "\x1b[36m";
        if (/^"/.test(match)) {
          if (/:$/.test(match)) {
            cls = "\x1b[34m";
          } else {
            cls = "\x1b[32m";
          }
        } else if (/true|false/.test(match)) {
          cls = "\x1b[35m";
        } else if (/null/.test(match)) {
          cls = "\x1b[31m";
        }
        return cls + match + "\x1b[0m";
      }
    );
  },
    async getData() {
      this.qtext = [];
      this.jsondata = {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[]};
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
                   //console.log(shapeNode);
                   this.jsondata.shapes.push({"id":collectionId+"shape"+count, "type":"shape", "shape_extra":shapeNode});
                   //this.shape_info.push({"id":collectionId+"shape"+count, "shape_extra":shapeNode});
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
      //.attr("viewBox", [0, 0, width, height]);
      //.attr("width", "101%")
      //.attr("height", "101%")

      .append("g")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)

  //       const g = svg.append("g")
  //       .attr("width", width + margin.left + margin.right)
  //       .attr("height", height + margin.top + margin.bottom)
  //       // .attr("cursor", "grab");
  //
  //
  //     svg
  //     .call(zoom)
  //   .call(zoom.transform, d3.zoomIdentity)
  //   .on("pointermove", event => {
  //     console.log(event);
  //     //const p = transform.invert(d3.pointer(event));
  //     //const i = delaunay.find(...p);
  //     //points.classed("highlighted", (_, j) => i === j);
  //     //d3.select(points.nodes()[i]).raise();
  //   })
  //
  //   let transform;
  //
  // const zoom = d3.zoom().on("zoom", e => {
  //   g.attr("transform", (transform = e.transform));
  //   g.style("stroke-width", 3 / Math.sqrt(transform.k));
  //   //points.attr("r", 3 / Math.sqrt(transform.k));
  // });

      // .attr("transform",
      // `translate(${margin.left}, ${margin.top})`);


    //
    //
    //   svg.call(d3.zoom()
    //   .extent([[0, 0], [width, height]])
    //   .scaleExtent([1, 8])
    //   .on("zoom", zoomed));
    //
    //
    // function zoomed({transform}) {
    //   g.attr("transform", transform);
    // }

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

      const shapes = svg
      .selectAll("circle2")
      .data(this.jsondata.shapes)
      .join("ellipse")
      .attr("rx", 60)
      .attr("ry", 20)
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
      //.on("click", function(d, i){clickCollection(d, i, svg)})
      .on("click", function(d, i){
        // svg.append("ellipse")
        // .attr("rx", 600)
        // .attr("ry", 200)
        // .style("fill", "#5e915a")
        // .style("left", d.x + 2 + window.pageXOffset + "px")
        // .style("top", d.y + 2 + window.pageYOffset + "px");
        // console.log("d:");
        // console.log(d);
        // console.log("i:");
        // console.log(i);
        // console.log("this:");
        // console.log(this);
        // console.log("all");
        // console.log(d3.selectAll('.bubbleText')._groups.NodeList);
        // d3.selectAll('.bubbleText').target.pop()['textContent']
        // for (let temp of d3.selectAll('.bubbleText')){
        //   //console.log(temp['__data__'].id);
        //   if(temp['__data__'].id == i.id){
        //     console.log(temp.textContent);
        //     temp.textContent = "BLUPBLUPBLUP"
        //   }
        // }
        // console.log("ding");
        // d3.selectAll('.bubbleText').selectAll(function(a){
        //   //console.log(a, i.id);
        //   if (a.id == i.id){
        //     console.log(a);
        //     //return a;
        //   }
        // });
        // console.log(d3.select(i.id));

        if (d3.select(this).attr("rx")==60){
          // d3.select(this).attr("rx", 600).attr("ry", 200);
          // d3.select(this).append('tspan').text("TESTING")

          for (let temp of d3.selectAll('.bubbleText')._groups.pop()){
            //for (let temp of ding){
            //console.log("test");
            //console.log(ding['__data__'].id);
            // for (let ding2 of ding){
            //   console.log(ding2);
            // }
            // console.log("dingdingding")
            // console.log(temp);



            //TODO fix indent, fix height being changed incorrectly when dragged
            if (temp['__data__'].id == i.id){

              temp.textContent = "";

              //console.log(d3.select(temp));

              //let startingX = temp.attributes.x.value;
              let startingX = d3.select(temp).attr("x");
              let startingY = d3.select(temp).attr("y");
              console.log(startingY);

              let textArray = JSON.stringify(temp['__data__'].shape_extra, null, '\t').split('\n');
              // console.log("textArray:");
              // console.log(textArray);
              d3.select(temp).attr("text-anchor","start");

              let offset = (31 + 20*textArray.length);
              d3.select(temp).attr("y", startingY - offset/2);
              console.log(d3.select(temp).attr("y"));

              // d3.select(temp).append('tspan').text(" ").attr("y", -1 * offset/2)

              for (let t of textArray){
                d3.select(temp).append('tspan').text(t).attr("dy", 20).attr("x", startingX);
              }

              //Use odd number so it can't ever be exactly 60 again
              d3.select(this).attr("rx", offset).attr("ry", 200);

              // bubblesText
              // .attr('x', function(d) { return d.x; })
              // .attr('y', function(d) { return d.y; });
            }
          //}
          }

          // for (let temp of d3.selectAll('.bubbleText')){
          //   if(temp['__data__'].id == i.id){
          //     //console.log(temp);
          //     //let textArray = JSON.stringify(temp['__data__'].shape_extra, null, '\t').split('\t');
          //     //temp.textContent = "";
          //     //temp.append('tspan').text(textArray[0]);
          //
          //     //temp.textContent = JSON.stringify(temp['__data__'].shape_extra, null, '\t');
          //     temp.append('tspan').text("TESTING");
          //
          //     //d3.select(this).append('tspan').text("TESTING2")
          //
          //     //console.log(JSON.stringify(temp['__data__'].shape_extra, null, '\t'));
          //     //temp.textContent = prettyJ(temp['__data__'].shape_extra);
          //     //console.log(prettyJ(temp['__data__'].shape_extra));
          //   }
          // }
        } else {
          d3.select(this).attr("rx", 60).attr("ry", 20);
          for (let temp of d3.selectAll('.bubbleText')){
            if(temp['__data__'].id == i.id){
              d3.select(temp).attr("text-anchor","middle");
              temp.textContent = temp['__data__'].type;
              //temp.text = "ding \t anderding" + '\t' + "test";
            }
          }
        }


        // console.log(d.target.rx);
        // d.target.rx = 600;
        // d.target.ry = 200;
        //i.rx = 600;
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

          if (d.ctrlKey) {
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
        } else {

          console.log("d:");
          console.log(d);
          console.log("i:");
          console.log(i);
          console.log("this:");
          console.log(this);
          console.log("test:");
          console.log(d3.select(i));
          console.log(d3.select(d));

          //console.log(d3.select(d).attr("rx"));
          console.log("target:")
          console.log(d3.select(d)._groups.pop().pop().target);
          //console.log(d3.select(d)._groups.pop().pop().target.attr("rx"));
          console.log("d3.select(target):")
          console.log(d3.select(d3.select(d)._groups.pop().pop().target))
          console.log("attr?:")
          console.log(d3.select(d3.select(d)._groups.pop().pop().target).attr("rx"))


          let d3Object = d3.select(d)._groups.pop().pop().target;
          d3.select(d3Object).raise();
          if (d3.select(d3Object).attr("rx")==90){

            for (let temp of d3.selectAll('.bubbleText')._groups.pop()){

              //TODO fix indent, fix height being changed incorrectly when dragged
              if (temp['__data__'].id == i.id){
                d3.select(temp).raise();

                console.log(temp);

                temp.textContent = "";

                let startingX = d3.select(temp).attr("x");
                let startingY = d3.select(temp).attr("y");

                let textArray = JSON.stringify(temp['__data__'], null, '\t').split('\n');
                d3.select(temp).attr("text-anchor","start");

                let offset = (31 + 20*textArray.length);
                d3.select(temp).attr("y", startingY - offset/2);


                for (let t of textArray){
                  d3.select(temp).append('tspan').text(t).attr("dy", 20).attr("x", startingX);
                }

                //Use odd number so it can't ever be exactly 60 again
                d3.select(d3Object).attr("rx", offset).attr("ry", 200);
              }
            }

          } else {
            d3.select(d3Object).attr("rx", 90).attr("ry", 20);
            for (let temp of d3.selectAll('.bubbleText')){
              if(temp['__data__'].id == i.id){
                d3.select(temp).attr("text-anchor","middle");
                temp.textContent = temp['__data__'].type;
              }
            }

        }


        }
      }

  //       function clickCollection(d, i, svg){
  //         if (i['shape_extra']){
  //           console.log(d,i,svg);
  //           // console.log(d3.select(d.target));
  //           // console.log(d3.select(i));
  //
  //
  //           // d3.select(i)
  //           // .enter().append("text")
  //           // .attr("text-anchor", "middle")
  //           // .text(function(i) {
  //           //   return (i['shape_extra'] + "")
  //           // });
  //           // console.log(d3.select(i));
  //
  //           // .style("left", d.x + 2 + window.pageXOffset + "px")
  //           // .style("top", d.y + 2 + window.pageYOffset + "px")
  //           // .html(i['shape_extra']);
  // //           console.log("should show popup");
  // //           var width = 300;
  // //           var height = 80;
  // //           var margin = {left:20,right:15,top:40,bottom:40};
  // //
  // //           //var div = d3.create("div")
  // // var svgX = svg.append("svg")
  // //   .attr("width", width+margin.left+margin.right)
  // //   .attr("height", height+margin.top+margin.bottom);
  // // var g = svgX.append("g")
  // //   .attr("transform","translate("+[margin.left,margin.top]+")");
  // //
  // //   console.log(g);
  // //   console.log("svg:");
  // //   console.log(svg);
  // //
  // //   svgX.selectAll('shape_popup')
  // //   .text(i['shape_extra'])
  // //
  // //   console.log(svgX);
  //
  //   //svg.append(g);
  //         }
  //       }


        var all = this.jsondata.nodes.concat(this.jsondata.relations.concat(this.jsondata.collection.concat(this.jsondata.shapes)));

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


        // const bubblesText = svg
        // .selectAll('bubbleText1')
        // .data(all, function(d) {
        //   return d.id;
        // })
        // .append("foreignObject")
        // .attr("width", 480)
        // .attr("height", 500)
        // .append("xhtml:div")
        // .style("font", "14px 'Helvetica Neue'")
        // .html("<p>Testing</p>")
        //.html(function(d){return (d.type + "").split('#').pop()});

        // .attr("text-anchor", "middle")
        // .attr("class", "bubbleText")
        // .text(function(d) {
        //   return (d.type + "").split('#').pop()
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

        //console.log(d3.selectAll('.bubbleText')._groups);
        // console.log("spullen");
        // for (let ding of d3.selectAll('.bubbleText')._groups.pop()){
        //   //console.log("test");
        //   //console.log(ding['__data__'].id);
        //   // for (let ding2 of ding){
        //   //   console.log(ding2);
        //   // }
        //
        //   if (ding['__data__'].id == 'https://treecg.github.io/demo_data/stops/shape0'){
        //     console.log(d3.select(ding));
        //     d3.select(ding).append('tspan').text("TESING");
        //   }
        // }

        // const bubblesText = svg
        // .selectAll('bubbleText1')
        // .data(all, function(d) {
        //   return d.id;
        // })
        // .enter().append('text')
        // .attr("text-anchor", "middle")
        // .attr("class", "bubbleText")
        // .tspans(function(d) {
        //   return (d.type + "").split('#').pop()
        // });


//         selection.append('text')
//     .tspans(function(d) {
//         return d.text.split('\n');
//     });
// selection.append('text').tspans(['Multiple', 'lines'], 20);



        //.call(drag(simulation));

        // Let's list the force we want to apply on the network

        const simulation = d3.forceSimulation(all)                 // Force algorithm is applied to data.nodes
        .force("link", d3.forceLink()                               // This force provides links between nodes
        .id(function(d) { return d.id; })                     // This provide  the id of a node
        .links(this.jsondata.links)                                    // and this the list of links
       )
       //.alphaDecay(0.5)
      //.force("charge", d3.forceManyBody().strength(-800))         // This adds repulsion between nodes. Play with the -400 for the repulsion strength
      //.force("center", d3.forceCenter(width / 2, height / 2))     // This force attracts nodes to the center of the svg area
      //.on("end", ticked);

      d3.forceSimulation(all)
          .force("charge", d3.forceManyBody().strength(-400))//.alphaDecay(0.5)

      d3.forceSimulation(this.jsondata.collection.concat(this.jsondata.nodes.concat(this.jsondata.shapes)))
          .force("charge", d3.forceManyBody().strength(-800))//.alphaDecay(0.5)

    d3.forceSimulation(this.jsondata.collection.concat(this.jsondata.relations.concat(this.jsondata.shapes)))
        .force("charge", d3.forceManyBody().strength(-2000))//.alphaDecay(0.5)

        d3.forceSimulation(this.jsondata.nodes)
      .force("center", d3.forceCenter(width / 2, height / 2))//.alphaDecay(0.5)

    //   d3.forceSimulation(this.jsondata.nodes)
    //       // Force algorithm is applied to data.nodes
    //       .force("charge", d3.forceManyBody().strength(-800))
    // .force("center", d3.forceCenter(width / 2, height / 2))     // This force attracts nodes to the center of the svg area
    //.on("end", ticked);

    d3.forceSimulation(this.jsondata.relations)
  .force("charge", d3.forceManyBody().strength(-3000))
  .alphaDecay(this.alpha_decay_rate)
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

        shapes
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
    // link.attr('d', function(d) {
    //     var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
    //     return path;
    // });
    // bubblesText
    // .attr('x', function(d) { return d.x; })
    // .attr('y', function(d) { return d.y; });

    ticked();
  }

  function dragendX() {
    d3.select(this).attr("stroke", null);
    // link.attr('d', function(d) {
    //     var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
    //     return path;
    // });
    // bubblesText
    // .attr('x', function(d) { return d.x; })
    // .attr('y', function(d) { return d.y; });
    ticked();
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
