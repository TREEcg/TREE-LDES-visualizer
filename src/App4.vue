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
      jsondata: {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[], "relations_holder":[]},
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
      //TODO is it possible to keep all quads, extract all metadata and then not have to check for doubles?
      //Simply by removing all doubles from the saved quads?

      //Need to clear the data before redrawing
      this.qtext = [];

      //this.jsondata = {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[], "relations_holder":[]};


      //console.log("TESTING:");
      //var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/a.nt';
      var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/.root.nt'
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

          if (metadata.collections.keys().length > 1){
            console.log("ERROR: found multiple collection! This is not allowed.");
            console.log(metadata.collections.keys());
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

              this.jsondata.collection.push({"id":collectionId, "name":collectionObj['@id'], "type":"collection", "vocab":collectionObj['@context']["@vocab"], "expanded": "false"});

              //TODO shape is an array, fix this with a for loop and make sure id's are different
              if (metadata.collections.get(collectionId).shape){
                var count = 0;
                for (var shapeNode of collectionObj.shape){
                  this.jsondata.shapes.push({"id":collectionId+"shape"+count, "type":"shape", "shape_extra":shapeNode, "expanded": "false"});
                  this.jsondata.links.push({"source":collectionId, "target":collectionId+"shape"+count, "name":"shape"});
                  count++;
                }

                // TODO Need to find a way to show actual shape data later
                // Maybe allow user to click on shape buble and simply show shape in text form in a new screen?

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
                  this.jsondata.nodes.push({"id":viewNode['@id']+"_node", "type":"Node", "name":viewNode['@id'], "relation_count":metadata.nodes.get(viewNode['@id']).relation.length, "offsetX": this.jsondata.nodes.length, "expanded": "false"});
                  this.jsondata.links.push({"source":collectionId, "target":viewNode['@id']+"_node", "name":"view"});
                  this.jsondata.relations_holder.push({"id":viewNode['@id']+"_relation_holder", "node_id":viewNode['@id']+"_node", "relation_count":metadata.nodes.get(viewNode['@id']).relation.length, "offsetX": this.jsondata.relations_holder.length, "expanded": "false"})
                  this.jsondata.links.push({"source":viewNode['@id']+"_node", "target":viewNode['@id']+"_relation_holder", "name":"relation_holder"});
                }
              }
            }

            //TODO add member check and visualisation
            //TODO don't forget to remove old members on adding new ones?

          }


          //This does not need a duplicate check since old node relations won't be included in the new metadata
          //or they will just overwrite with the exact same data as was already present
          for (var nodeId of metadata.nodes.keys()){
            var nodeObj = metadata.nodes.get(nodeId);
            this.jsondata[nodeId+"_node"] = [];
            //console.log(nodeId);
            //console.log(this.jsondata.nodes);
            //console.log(nodeObj.relation.length);
            for (var relation of nodeObj.relation){
              this.jsondata[nodeId+"_node"].push({"id":relation['@id'], "node_id":nodeId+"_node", "name":relation['@id'], "type":"relation", "expanded": "false"});
              //Don't forget to add _node to the source id, else all relations will be linked to the collection not the node
              //this.jsondata.links.push({"source":nodeId+"_node", "target":relation['@id'], "name":"relation"});
            }
          }

          for (let relationNode of this.jsondata.nodes){
            //console.log("tst: ", relationNode.id);
            //console.log(this.jsondata[relationNode.id])
            for (var relationJson of this.jsondata[relationNode.id]){
              if (metadata.relations.get(relationJson.id)){

              var relationObj = metadata.relations.get(relationJson.id);
              relationJson.type = relationObj['@type'];
              relationJson.node = relationObj.node;
              relationJson.path = relationObj.path;
              relationJson.value = relationObj.value;
              relationJson.remainingItems = relationObj.remainingItems;
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

      d3.selectAll("svg").remove();

      //var all = this.jsondata.nodes.concat(this.jsondata.relations.concat(this.jsondata.collection.concat(this.jsondata.shapes)));
      var all = this.jsondata.nodes.concat(this.jsondata.collection.concat(this.jsondata.shapes.concat(this.jsondata.relations_holder)));


      //TODO fix scrolling, zoom,
      // append the svg object to the body of the page
      const svg = d3.select("#my_dataviz")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .append("svg")
      .attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom)
      .attr("pointer-events", "all");



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
      .attr("class", "collection_g")
      .call(d3.drag()
      .on("start", dragstartX)
      .on("end", dragendX)
      .on("drag", dragX));

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


      const shape = svg
      .selectAll("gshape")
      .data(this.jsondata.shapes)
      .join("g")
      .attr("class", "shape_g")
      .attr("expanded", function(d){return d.expanded;})
      .on("click", clickShape.bind(this))
      .call(d3.drag()
      .on("start", dragstartX)
      .on("end", dragendX)
      .on("drag", dragX));

      console.log(shape);

      shape.append("rect")
      .attr("class", "shape_rect")
      .attr("width", 80)
      .attr("height", 30)
      .style("fill", "#5e915a")

      shape.append("text")
      .attr("text-anchor", "start")
      .attr("class", "shape_text")
      .attr("dy",20)
      .text(function(d) {
        return (d.type + "").split('#').pop()
      })
      .raise();


      const node = svg
      .selectAll("gnode")
      .data(this.jsondata.nodes)
      .join("g")
      .attr("class", "node_g")
      .call(d3.drag()
      .on("start", dragstartX)
      .on("end", dragendX)
      .on("drag", dragX));

      node.append("rect")
      .attr("class", "node_rect")
      .attr("width", 80)
      .attr("height", 30)
      .style("fill", "#69b3a2")

      node.append("text")
      .attr("text-anchor", "start")
      .attr("class", "node_text")
      .attr("dy",20)
      .text(function(d) {
        return (d.type + "").split('#').pop()
      })
      .raise();


      const relation_holder = svg
      .selectAll("grelation_holder")
      .data(this.jsondata.relations_holder)
      .join("g")
      .attr("class", "relation_holder_g")
      .attr("expanded", function(d){return d.expanded;})
      .on("click", clickRelationHolder.bind(this))
      .call(d3.drag()
      .on("start", dragstartX)
      .on("end", dragendX)
      .on("drag", dragX));

      relation_holder.append("rect")
      .attr("class", "relation_holder_rect")
      .attr("width", 120)
      .attr("height", 30)
      .style("fill", "#6562cc")

      relation_holder.append("text")
      .attr("text-anchor", "start")
      .attr("class", "relation_holder_text")
      .attr("dy",20)
      .text(function(d) {
        return "relations: " + d.relation_count
      })
      .raise();


      d3.forceSimulation(all)
      .force("link", d3.forceLink()
      .id(function(d) { return d.id; })
      .links(this.jsondata.links)
      //.distance(200)
      )
      .alphaDecay(this.alpha_decay_rate)
      .on("tick", firstTick.bind(this));


      //TODO change this to collection fixed top left
      //shape to the right off collection
      //node beneath collection, every next node should be moved somewhat to the right
      //relation underneath the connected node
      // use "offsetX" from the json.nodes / relations_holder and multiply with 100?

      // d3.forceSimulation(all)
      // .force("center", d3.forceCenter(width / 2, height / 2))
      // .force("charge", d3.forceManyBody().strength(-800))
      // .alphaDecay(this.alpha_decay_rate)
      // .on("tick", firstTick.bind(this));


      //console.log("testing:")
      //console.log(d3.select(collection).node())

      //shape.attr("x", d3.select(collection).node().getBBox().width + 60).attr("y", 20)


      function firstTick(){
        for(let tempG of shape){
          if(d3.select(tempG).attr("expanded") == "true"){
            expandShapeTrue.bind(this)(d3.select(tempG), tempG['__data__']);
          }
        }
        for(let tempG of relation_holder){
          if(d3.select(tempG).attr("expanded") == "true"){
            expandRelationHolderTrue.bind(this)(d3.select(tempG), tempG['__data__']);
          }
        }
        ticked();

        svg.selectAll(".collection_g").attr("x", function(d){d.x=50; return d.x}).attr("y", function(d){d.y=20; return d.y});
        svg.selectAll(".shape_g").attr("x", function(d){d.x=200+50; return d.x}).attr("y", function(d){d.y=20; return d.y});
        svg.selectAll(".node_g").attr("x", function(d){d.x=50+d.offsetX*500; return d.x}).attr("y", function(d){d.y=150; return d.y});
        svg.selectAll(".relation_holder_g").attr("x", function(d){d.x=50+d.offsetX*500; return d.x}).attr("y", function(d){d.y=300; return d.y});

        fixGroupChildren();
        fixLinks();
      }

      function ticked() {
        console.log("ticked");

        d3.selectAll("g")
        .attr("x", function(d) {
          return d.x;
        })
        .attr("y", function(d) {
          return d.y;
        })

        fixGroupChildren()

        fixLinks()

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
        d3.selectAll("rect, text")
        .attr("x", function(d) {return d.x;})
        .attr("y", function(d) {return d.y;});

        d3.selectAll("tspan")
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

        //console.log(d3.selectAll('g'));
      }



      //The event.transform does not change during session, it simply get added onto every time
      svg.attr("prevTX", 0).attr("prevTY", 0).attr("scaleAll", 1);

      const zoom = d3.zoom()

      zoom.on("zoom", function(e) {
        d3.selectAll("g")
        .attr("transform", function(){return "translate("+(e.transform.x- d3.select("svg").attr("prevTX"))+","+(e.transform.y- d3.select("svg").attr("prevTY"))+")scale("+e.transform.k+")"});

        fixLinks();
        link.attr("transform", function(){return "translate("+(e.transform.x- d3.select("svg").attr("prevTX"))+","+(e.transform.y- d3.select("svg").attr("prevTY"))+")scale("+e.transform.k+")"});
      });

      zoom.on("end", function(e) {

      d3.selectAll("g")

      .attr("transform", function(){return "scale("+e.transform.k+")"})
      .attr("x", function(d) { d.x += e.transform.x - d3.select("svg").attr("prevTX")})
      .attr("y", function(d) { d.y += e.transform.y - d3.select("svg").attr("prevTY")})

      svg.attr("prevTX", e.transform.x).attr("prevTY", e.transform.y).attr("scaleAll", e.transform.k);

      fixGroupChildren()

      fixLinks();

      });

      svg.call(zoom);


      function clickRelationHolder(event, d){
        if (event.ctrlKey) {
          //TODO what if node data is wrong, multiple urls, etc?
          console.log(d3.select(event.target).attr("node_link"));

          //console.log(metadata.relations.get(i.id).node[0]['@id']);
          this.data_url = d3.select(event.target).attr("node_link");
          //d3.selectAll(".tooltip").remove();
          this.getData();
        } else {

          let currentg = d3.select(event.target.parentNode);
          //currentg could be tspan parent = text and not the group
          if (currentg.attr("class") != "relation_holder_g"){
            currentg = d3.select(currentg._groups.pop().pop().parentNode);
          }

          expandRelationHolder.bind(this)(currentg, d);

          ticked();
        }

      }


      function clickShape(event, d){
        let currentg = d3.select(event.target.parentNode);
        if (currentg.attr("class") != "shape_g"){
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
        for (let textX of textArray){
          let indent = (textX.split('\t').length -1) * 4;
          currentg.select("text").append('tspan')
          .text(textX.replace('\t',''))
          .attr("dy", 20)
          .attr("dx", indent-prevIndent + 5);
          prevIndent = indent-prevIndent;
        }

        currentg.select("text").selectAll("text, tspan")
        .attr("x", function(d) {return d.x;})

        currentg.select("rect").attr("width", currentg.node().getBBox().width + 10);
      }


      function expandRelationHolder(currentg, d){
        if(currentg.attr("expanded") == "false"){
          currentg.attr("expanded", "true");

          expandRelationHolderTrue.bind(this)(currentg, d);

        } else {
          currentg.attr("expanded", "false");
          for(let temp of this.jsondata.relations_holder){
            if (temp.id == d.id){
              temp.expanded = "false";
            }
          }
          currentg.select("text").text("relations: " + d.relation_count)
          currentg.select("rect").attr("width", 1);
          currentg.select("text").selectAll("tspan")
          .attr("x", function(d) {return d.x;})
          currentg.select("rect")
          .attr("height", 30)
          .attr("width", currentg.node().getBBox().width + 10);
        }
      }


      function expandRelationHolderTrue(currentg, d){
        for(let temp of this.jsondata.relations_holder){
          if (temp.id == d.id){
            temp.expanded = "true";
          }
        }

        currentg.raise();

        currentg.select("rect")
        .attr("height", 10 + 20*this.jsondata[d.node_id].length)

        currentg.select("text").text("");

        for (let relX of this.jsondata[d.node_id]){
          let textX = (relX.type + "").split('#').pop() + ": "
          for (let v of relX.value){
            textX += v['@value'] + ", ";
          }
          for (let v of relX.path){
            textX += v['@id']//(v['@id'] + "").split("/").pop();
          }

          let tempSpan = currentg.select("text").append('tspan')
          .text(textX)
          .attr("dy", 20)
          .attr("x", currentg.select("rect").attr("x"));

          if(relX.node){
            tempSpan.attr("node_link", relX.node[0]['@id']);
          }

        }

        currentg.select("text").selectAll("text, tspan")
        .attr("x", function(d) {return d.x;})
        currentg.select("rect").attr("width", currentg.node().getBBox().width + 10);
      }




    }

  }

}

</script>
