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
      console.log(metadata);
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


      //
      // var width = 1560,
      //     height = 800;

     var nodes = this.jsondata.nodes.concat(this.jsondata.relations.concat(this.jsondata.collection));
     var links = this.jsondata.links;

     var force = d3.forceSimulation(nodes)
     //.force("link", d3.forceLink(links))
     .force("link", d3.forceLink()
     .id(function(d) { return d.id; })
     .links(this.jsondata.links))
     //.size([width, height])//Scope size
     //.linkDistance(180)//Length of connecting line
     //.charge(-1500)//The charge number of the vertex. This parameter determines whether it is repelling or attracting, the smaller the value, the more mutually exclusive
     .force("center", d3.forceCenter(width / 2, height / 2))
     .force("charge", d3.forceManyBody().strength(-3000))
     .on("end", tick)//refers to the time interval, refresh the screen at intervals
     //.start();//Start conversion

      // var force = d3.layout.force()//layout converts the json format to the format available for mechanical drawings
      // .nodes(d3.values(nodes))//Set node array
      // .links(links)//Set connection array
      // .size([width, height])//Scope size
      // .linkDistance(180)//Length of connecting line
      // .charge(-1500)//The charge number of the vertex. This parameter determines whether it is repelling or attracting, the smaller the value, the more mutually exclusive
      // .on("tick", tick)//refers to the time interval, refresh the screen at intervals
      // .start();//Start conversion

      console.log(links);
      console.log(nodes);

      // var svg = d3.select("body")
      //     .append("svg")
      //     .attr("width", width)
      //     .attr("height", height);

          const svg = d3.select("#my_dataviz")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          .append("svg")
          .attr("width", width + margin.left + margin.right)
          .attr("height", height + margin.top + margin.bottom)
          // .append("g")
          // .attr("width", width + margin.left + margin.right)
          // .attr("height", height + margin.top + margin.bottom)

      //arrow
      var marker=
      svg.append("marker")
      //.attr("id", function(d) { return d; })
      .attr("id", "resolved")
      //.attr("markerUnits","strokeWidth")//The arrow set to strokeWidth will change with the thickness of the line
      .attr("markerUnits","userSpaceOnUse")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX",32)//Arrow coordinates
      .attr("refY", -1)
      .attr("markerWidth", 12)//The size of the logo
      .attr("markerHeight", 12)
      .attr("orient", "auto")//Drawing direction, can be set to: auto (automatically confirm the direction) and angle value
      .attr("stroke-width",2)//arrow width
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")//The path of the arrow
      .attr('fill','gray');//Arrow color

      console.log(marker);

      /* Set the connection line to curve
      var path = svg.append("g").selectAll("path")
          .data(force.links())
          .enter().append("path")
          .attr("class", function(d) { return "link " + d.type; })
          .style("stroke",function(d){
              //console.log(d);
      "return "#A254A2";//The color of the connection line
          })
          .attr("marker-end", function(d) { return "url(#" + d.type + ")"; });
      */

      // const link = svg
      // .selectAll("line1")
      // .data(this.jsondata.links)
      // .join("line")
      // .style("stroke", "#aaa")

      //Set up the connection line
      var edges_line = svg.selectAll(".edgepath")
          .data(links)
          .enter()
          .append("path")
          // .attr({
          //       'd': function(d) {return 'M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y},
          //       'class':'edgepath',
          //       //'fill-opacity':0,
          //       //'stroke-opacity':0,
          //       //'fill':'blue',
          //       //'stroke':'red',
          //       'id':function(d,i) {return 'edgepath'+i;}})
          .style("stroke","gray")
          .style("pointer-events", "none")
      .style("stroke-width",0.5)//line thickness
      .attr("marker-end", "url(#resolved)" );//Mark the arrow according to the id number of the arrow mark

      // var edges_text = svg.append("g").selectAll(".edgelabel")
      // .data(force.links())
      // .enter()
      // .append("text")
      // .style("pointer-events", "none")
      // //.attr("class","linetext")
      // .attr({  'class':'edgelabel',
      //                'id':function(d,i){return 'edgepath'+i;},
      //                'dx':80,
      //                'dy':0
      //                //'font-size':10,
      //                //'fill':'#aaa'
      //                });
      //
      // //Set the text on the line
      // edges_text.append('textPath')
      // .attr('xlink:href',function(d,i) {return '#edgepath'+i})
      // .style("pointer-events", "none")
      // .text(function(d){return d.rela;});

      //Circle
      var circle = svg.append("g").selectAll("circle")
      .data(nodes) // means use force.nodes data
          .enter().append("circle")
          .style("fill","white")
          .style('stroke',"gray")
      .attr("r", 28)//Set the circle radius
      //     .on("click",function(node){
      //         console.log(node.id);
      // // Make the connection line bold
      //
      // //when you click
      //         edges_line.style("stroke-width",function(line){
      //             if(line.source.name==node.name || line.target.name==node.name){
      //                 return 2;
      //             }else{
      //                 return 0.5;
      //             }
      //         });
      //         //d3.select(this).style('stroke-width',2);
      //     })
      // .call(force.drag);//Pass the currently selected element to the drag function so that the vertex can be dragged
          /*
           circle.append("text")
          .attr("dy", ".35em")
      .attr("text-anchor", "middle")//Add text inside the circle
          .text(function(d) {
              //console.log(d);
              return d.name;
          }); */

       //Circle prompt text
        circle.append("svg:title")
              .text(function(node) {
                console.log(node);
      return "Double-click to see details";
               });
      /* rectangle
      var rect=svg.append("rect")
               .attr({"x":100,"y":100,
                      "width":100,"height":50,
      "rx": 5, // horizontal fillet
      ”"ry":10//Vertical rounded corners
                   })
                .style({
                   "stroke":"red",
                   "stroke-width":1,
                   "fill":"yellow"
      });*/
      // var text
      //
      // = svg.append("g").selectAll("text")
      //     .data(force.nodes())
      // //Return a placeholder for missing elements, pointing to a part of the elements in the bound data that is more than the selected element set.
      //     .enter()
      //     .append("text")
      //     .attr("dy", ".35em")
      // .attr("text-anchor", "middle")//Add data to the circle
      //     .style('fill',"gray")
      //     .attr('x',function(d){
      //         // console.log(d.name+"---"+ d.name.length);
      //         var re_en = /[a-zA-Z]+/g;
      // //If it is all English, no line breaks
      //         if(d.name.match(re_en)){
      //              d3.select(this).append('tspan')
      //              .attr('x',0)
      //              .attr('y',2)
      //              .text(function(){return d.name;});
      //         }
      // //If it is less than four characters, do not wrap
      //         else if(d.name.length<=4){
      //              d3.select(this).append('tspan')
      //             .attr('x',0)
      //             .attr('y',2)
      //             .text(function(){return d.name;});
      //         }else{
      //             var top=d.name.substring(0,4);
      //             var bot=d.name.substring(4,d.name.length);
      //
      //             d3.select(this).text(function(){return '';});
      //
      //             d3.select(this).append('tspan')
      //                 .attr('x',0)
      //                 .attr('y',-7)
      //                 .text(function(){return top;});
      //
      //             d3.select(this).append('tspan')
      //                 .attr('x',0)
      //                 .attr('y',10)
      //                 .text(function(){return bot;});
      //         }
      // // direct text display
      //         /*.text(function(d) {
      //         return d.name; */
      //     });

      /* Display text outside the circle
      var text2 = svg.append("g").selectAll("text")
           .data(force.links())
      //Return a placeholder for missing elements, pointing to a part of the elements in the bound data that is more than the selected element set.
          .enter()
          .append("text")
      .attr("x", 150)//Set text coordinates
          .attr("y", ".50em")
          .text(function(d) {
              //console.log(d);
              //return d.name;
              //return d.rela;
              console.log(d);
              return  '1111';
          });*/

      function tick() {
      //path.attr("d", linkArc);//Connection line
      circle.attr("transform", transform1);//circle
      //text.attr("transform", transform2);//Vertex text
        //edges_text.attr("transform", transform3);
      //text2.attr("d", linkArc);//Link text
        //console.log("text2...................");
        //console.log(text2);
        //edges_line.attr("x1",function(d){ return d.source.x; });
        //edges_line.attr("y1",function(d){ return d.source.y; });
        //edges_line.attr("x2",function(d){ return d.target.x; });
        //edges_line.attr("y2",function(d){ return d.target.y; });

        //edges_line.attr("x",function(d){ return (d.source.x + d.target.x) / 2 ; });
        //edges_line.attr("y",function(d){ return (d.source.y + d.target.y) / 2 ; });


        edges_line.attr('d', function(d) {
            var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
            return path;
        });

        // edges_text.attr('transform',function(d,i){
        //       if (d.target.x<d.source.x){
        //           bbox = this.getBBox();
        //           rx = bbox.x+bbox.width/2;
        //           ry = bbox.y+bbox.height/2;
        //           return 'rotate(180 '+rx+' '+ry+')';
        //       }
        //       else {
        //           return 'rotate(0)';
        //       }
        //  });
      }

      //Set the coordinates of the connecting line, use bidirectional encoding of elliptical arc path segment
      // function linkArc(d) {
      //     //var dx = d.target.x - d.source.x,
      //   // dy = d.target.y - d.source.y,
      //      // dr = Math.sqrt(dx * dx + dy * dy);
      //   //return "M" + d.source.x + "," + d.source.y + "A" + dr + "," + dr + " 0 0,1 " + d.target.x + "," + d.target.y;
      // //The format of the dotted path is: Msource.x,source.yArr00,1target.x,target.y
      //
      //   return 'M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y
      // }
      //Set the coordinates of the circle and text
      function transform1(d) {
        return "translate(" + d.x + "," + d.y + ")";
      }
      // function transform2(d) {
      //       return "translate(" + (d.x) + "," + d.y + ")";
      // }

      console.log(force);





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
