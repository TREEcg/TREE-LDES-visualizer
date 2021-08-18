<template>

  <p style="white-space: pre-line">Click a node, relation or shape to show all attributes<br>
  ctrl+click a relation to add the node to the graph<br>
  shift+mousewheel / shift+pan to zoom or pan<br>
  Drag screen corner to resize views<br>
  An arrowhead next to a node means the node has a relation with itself as the node</p>

  <label for="adecay">Enter graph convergence speed, between 0 and 1</label>
  <input type="number" v-model="alpha_decay_rate" placeholder="0.023" name="adecay"><br>

  <label for="url">Enter URL: </label>
  <input type="url" v-model="data_url" placeholder="URL" name="url"><br>

  <button v-on:click="start(undefined)">Draw Graph</button>

  <button v-on:click="validateAll()">Validate and add all reachable nodes</button><br>

  <p>All members conform to shape: {{this.shape_validation}}</p>

  <label for="checkbox_shape">Show shape validation report</label>
  <input type="checkbox" id="checkbox_shape" v-model="checked_shape">

  <div v-if="checked_shape">
    <div v-if="shape_report">
      <div style="white-space: pre-line">{{this.shape_report}}</div>
    </div>
    <div v-else>
      <p>No report available.</p>
    </div>
  </div>

  <div id="my_dataviz" style="overflow:scroll; resize: both;"></div>

  <!-- <label for="checkbox_remarks">Show data remarks</label>
  <input type="checkbox" id="checkbox_remarks" v-model="checked_remarks">

  <div v-if="checked_remarks">
    <div v-if="remarks">
      <div style="white-space: pre-line">{{remarks}}</div>
    </div>
    <div v-else>
      <p>No remarks to report.</p>
    </div>
  </div> -->



<!-- This empty div allows user to resize extra info screen easily -->
  <div style="height: 100px;"></div>

  <div id="windowContainer">
    <div class="divFloat" id="scrollContainer">
      <div v-on:click="close()" class="close"></div>
      <div class="container">

        <select v-model="selected">
          <option value=0>Node</option>
          <option value=1>Members</option>
          <option value=2>Shape validation</option>
        </select>
      </div>
      <div id="extra"></div>
    </div>
  </div>

</template>


<script>

import * as d3 from "d3";
import * as dF from './components/dataFunctions.js';

/*
POSSIBLE TODO OVERVIEW
  show what members actually got validated, member might not have correct attributes targeted by shape
  support for multiple collections at the same URL?
  support for multiple nodes (not views) at the same URL?
  support for working importStream
    this means adding it to function addImportLinks(data)
  support for working tree:search
  conditionalImport now gets imported without checking conditions
    this means adding a check at function addImportLinks(data)
  possibility to check every reachable node against current shape
    a function that calls getData with first every view and then every relation->node
      do not forget to call addImportLinks(data) for every relation before following a node
      do not forget to keep a list of checked nodes
      might be prudent to only call drawing() when all nodes have been traversed (slow & might crash)
      should probably not throw any alerts while doing the traversal but bundle them in an automatically updating report
          probably via adding this.remarks to something before calling getData again
      shacl validation report at the top of the page should already update automatically for every node
*/

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
      selected: 0,
      alpha_decay_rate: 0.5,//1 - Math.pow(0.001, 1 / 300)
      shapeTargets: ['targetClass', 'targetNode', 'targetSubjectsOf', 'targetObjectsOf'],
      // Add possible properties from metadata extraction to these arrays
      collectionSpecial: ["@type", "import", "importStream", "conditionalImport", "totalItems"],
      nodeSpecial: ["@type", "import", "importStream", "conditionalImport", "search", "retentionPolicy"],
      // value, path, node, remainingItems are checked in a different way
      relationSpecial: ["import", "importStream", "conditionalImport"],
      newImportLinks: new Set(),
      importedQuads: new Map()
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

    //url = undefined & this.data_url defined if you wish to start a new collection
    start(url){
      dF.setDataUrl(this.data_url);
      dF.getData(url, this.cB, this.fixReport, this.svgClear);
    },
    validateAll(){
      dF.setDataUrl(this.data_url);
      dF.validateAll(this.data_url, this.cB);
    },
    copyData(){
      // TODO at some point these should probably just get fixed in the code instead of copying them over
      this.qtext = dF.qtext;
      this.jsondata = dF.jsondata;
      this.members = dF.members;
      this.membersFailed = dF.membersFailed;
      this.remarks = dF.remarks;
      this.data_url = dF.data_url;
      this.shape_validation = dF.shape_validation;
      this.node_validation = dF.node_validation;
      this.shape_report = dF.shape_report;
      this.shapeTargets = dF.shapeTargets;
      this.collectionSpecial = dF.collectionSpecial;
      this.nodeSpecial = dF.nodeSpecial;
      this.relationSpecial = dF.relationSpecial;
      this.newImportLinks = dF.newImportLinks;
      this.importedQuads = dF.importedQuads;
    },
    svgClear(){
      d3.select("#extra").selectAll("svg").remove();
      this.svgHolder = null;
      this.svgGHolder = null;
    },
    cB(){
      this.copyData();
      this.drawing();
    },
    fixReport(){
      this.copyData();
    },
    close(){
      document.getElementById("windowContainer").style.display = "none";
    },
    open(){
      document.getElementById("windowContainer").style.display = "block";
    },

    drawing() {
      const margin = {top: 10, right: 30, bottom: 10, left: 30};

      const width = this.graph_width - margin.left - margin.right;
      const height = this.graph_height - margin.top - margin.bottom;

      //clear the graph on redrawing
      d3.select("#my_dataviz").selectAll("svg").remove();

      const linkData = [];
      this.jsondata.links.forEach((s, k) => {s.forEach(v => linkData.push({"source":k,"target":v}))});
      console.log("linkData: ", linkData);
      var all = this.jsondata.collection.concat(this.jsondata.shapes.concat(this.jsondata.nodes));

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


      svg.append("marker")
      .attr("id", "arrow")
      .attr("markerUnits","userSpaceOnUse")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX",0)//Arrow coordinates
      .attr("refY", 0)
      .attr("markerWidth", 12)//The size of the logo
      .attr("markerHeight", 12)
      .attr("orient", "auto")//Drawing direction, can be set to: auto (automatically confirm the direction) and angle value
      .attr("stroke-width",2)//arrow width
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")//The path of the arrow
      .attr('fill','gray');//Arrow color


      const link = svg.selectAll(".edgepath")
      .data(linkData)
      .enter().append("polyline")
      .style("stroke","gray")
      .style("pointer-events", "none")
      .style("stroke-width",0.5)
      .attr("marker-mid", "url(#arrow)" );


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



      if (this.jsondata.nodes.length > 0){
        const node = svg
        .selectAll("gnode")
        .data(this.jsondata.nodes)
        .join("g")
        .attr("class", "node_g main_g")
        .on("click", clickRelationHolder.bind(this))
        .call(d3.drag()
        .on("start", dragstartX)
        .on("end", dragendX)
        .on("drag", dragX));

        node.append("text")
        .attr("text-anchor", "start")
        .attr("class", "node_text main_text")
        .attr("dx", 5)
        .attr("dy",20)
        .text("")
        .raise();

        for (let tg of d3.selectAll(".node_g")){
          d3.select(tg).select("text")
          .append("tspan").text("Node")
          .attr("dx",5);

          d3.select(tg).select("text")
          .append("tspan").text(function(d){return d.name})
          .attr("dx",5);

          d3.select(tg).select("text")
          .append("tspan").text(function(d){return "relations: " + d.relation_count})
          .attr("dx",15);

          d3.select(tg).selectAll("tspan").attr("x", 0).attr("dy", 22);

          d3.select(tg).append("rect")
          .attr("class", "node_rect main_rect")
          .attr("width", d3.select(tg).select("text").node().getBBox().width+15)
          .attr("height", d3.select(tg).select("text").node().getBBox().height+10)
          .style("stroke", "#69b3a2")
          .lower();
        }
      }



      d3.forceSimulation(all)
      .force("link", d3.forceLink()
      .id(function(d) { return d.id; })
      .links(linkData)
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
        // Calculate start, mid, end
        link.attr("points", function(d) {
             return [
                  d.source.x, d.source.y,
                  d.source.x/2+d.target.x/2, d.source.y/2+d.target.y/2,
                  d.target.x, d.target.y
             ].join(',');
        })
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

          currentg.select("rect")
          .attr("height", 30)
          .attr("width", currentg.node().getBBox().width + 10);
        }
      }

      function expandCollectionTrue(currentg, d){
        currentg.raise();
        let tt = currentg.select("text");
        tt.text("");

        tt.append("tspan").text("Collection")
        .attr("dx",5);

        tt.append("tspan").text(d.id)
        .attr("dx",15);

        for (let pAttr of this.collectionSpecial){
          if (d[pAttr]){
            tt.append("tspan").text(`${pAttr}:`)
            .attr("dx",5);
            for (const value of Object.values(d[pAttr])) {
              let textArray = JSON.stringify(value, null, '\t').split('\n');
              let regex = /^(\t*{\t*)|(\t*}\t*)|(\t*],*\t*)$/g;
              for (let textX of textArray){
                if (!textX.match(regex)){
                  let indent = (textX.split('\t').length -1) * 20;
                  tt.append('tspan')
                  .text(" " + textX.replace(': [',': '))
                  .attr("dx", indent + 15);
                }
              }
            }
          }
        }

        tt.selectAll("tspan").attr("dy", 22);

        currentg.select("rect")
        .attr("height", 10 + currentg.select("text").node().getBBox().height)

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

        currentg.select("rect").attr("width", currentg.node().getBBox().width + 10);
      }


      this.drawing.setVisible = setVisible.bind(this);
      function setVisible(){
        for (let sX of this.svgHolder){
          sX.attr("display", "none");
        }

        this.svgHolder[this.selected].attr("display", "inline");

        var el = document.getElementById("scrollContainer");
        el.scrollTop = 0;
        el.scrollLeft = 0;
      }


      // Only d is used and only for id, name, relation_count so standalone would be possible, with access to the extracted data ofcourse
      function clickRelationHolder(e, d){
        // Remove all previous showing details
        for (let sX of this.svgGHolder){
          sX.selectAll("g").remove();
        }

        // Display everything first so they have a correct viewbox attribute to use in calculations
        for (let sX of this.svgHolder){
          sX.attr("display", "inline");
        }
        this.open();

        if (d.relation_count && d.relation_count > 0){
          expandRelationHolder.bind(this)(d);
        }

        expandMemberHolder.bind(this)(d);

        expandValidationHolder.bind(this)(d);

        setVisible.call(this);
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

        expandMemberHolder.call(this, d, false, newG.node().getBBox().height+22);
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
            if (showAll === true || (this.membersFailed[d.name] && this.membersFailed[d.name].includes(tempA))){
              let innerG = newG.append("g")
              .attr("sortIndex", sortIndex)
              .attr("expanded", "false")
              .attr("class", "member_g")
              .attr("y", 22+44*sortIndex + offsetH);

              let tt = innerG.append("text").text(tempA)
              .attr("sortIndex", sortIndex)
              .attr("y", 22+44*sortIndex + offsetH);

              if (this.membersFailed[d.name] && this.membersFailed[d.name].includes(tempA)){
                tt.style("fill", "#FF0000");
              }

              innerG.on("click", expandMember.bind(this, d, innerG, tempA, newG, showAll));

              sortIndex++;
            }
          }

        } else if (!this.members[d.name]){
          newG.append("g").append("text").text("This node has no members.")
          .attr("dy", 20)
          .attr("dx", 5)
          .attr("x", 0)
          .attr("y", 22 + offsetH);
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


      function expandRelationHolder(d){
        let newG = svgEG.append("g").attr("class", "new_g");
        let tt = newG.append("text");

        expandRelationHolderNodeInfo.call(this, d, tt);

        let offH = tt.node().getBBox().height + 30;
        let innerg = newG.append("svg:foreignObject")
          .attr("x", 50)
          .attr("y", offH)
          .attr("width", 600)
          .attr("height", 600);

        var table = innerg.append('xhtml:table');
        var thead = table.append('thead');
        var	tbody = table.append('tbody').attr("id", "my_tbody");

        var tableColumns = ["type", "value", "path"];
        var tableData = parseTableData.call(this, d);


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
          trX.onclick = tableClick.bind(this, count, this.jsondata[d.id][count], newG, innerg, table, true)

          for(let valueX of Object.values(dataX)){
            let textX = document.createTextNode(valueX);
            let tdX = trX.insertCell();
            tdX.appendChild(textX);
          }

          trX = tbody.insertRow();
          trX.style.visibility = "collapse";
          trX.id = "large"+count;
          trX.onclick = tableClick.bind(this, count, this.jsondata[d.id][count], newG, innerg, table, false)

          let textX = document.createTextNode(createExtraCell.call(this, this.jsondata[d.id][count]));

          let tdX = trX.insertCell();
          tdX.classList.add('spacing');
          tdX.colSpan = tableColumns.length;
          tdX.appendChild(textX);

          count++;
        }

        let bboxT = table.node();
        innerg.attr("width", bboxT.offsetWidth).attr("height", bboxT.offsetHeight);

        newG.append("rect").attr("x", 0).attr("y", 0).style("stroke", "#69b3a2")
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



      function expandRelationHolderNodeInfo(d, tt){
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
      }


      function parseTableData(d){
        var tableData = [];
        for (let relX of this.jsondata[d.id]){
          let rowData = {};
          if(relX.type){
            rowData.type = (relX.type + "").split('#').pop();
          } else {
            rowData.type = "No Type";
          }

          if (relX.value){
            let tempV = ""
            for (let v of relX.value){
              if(!v['@value']){
                tempV += 'Nested value, expand to view';
              } else {
                tempV += v['@value'] + ", ";
              }
            }
            rowData.value = tempV.slice(0,-2);
          } else {
            rowData.value = "No Value";
          }

          if (relX.path){
            let tempP = ""
            for (let v of relX.path){
              if(!v['@id']){
                tempP += 'Nested path, expand to view';
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
        return tableData;
      }



      function tableClick(index, relationData, newG, innerg, table, expand = true){
        if (window.event.ctrlKey) {
          dF.addImportLinks(relationData);
          this.start(relationData.node[0]["@id"]);
          return;
        }

        if (expand === true){
          document.getElementById("large"+index).style.visibility = "visible";
          document.getElementById("small"+index).style.visibility = "collapse";
        } else {
          document.getElementById("small"+index).style.visibility = "visible";
          document.getElementById("large"+index).style.visibility = "collapse";
        }

        newG.selectAll(".outer_rect").attr("width", 0).attr("height", 0);
        let bboxT = table.node();
        innerg.attr("width", bboxT.offsetWidth).attr("height", bboxT.offsetHeight);

        newG.selectAll(".outer_rect").attr("width", newG.node().getBBox().width+30)
        .attr("height", newG.node().getBBox().height+30);

        let bbox = svgEG.node().getBBox();
        svgE.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
        .attr("width", (bbox.width+bbox.x))
        .attr("height", (bbox.height+bbox.y));
      }



      function createExtraCell(relX){
        const regex = /^(\t*{\t*)|(\t*}\t*)|(\t*],*\t*)$/g;
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
                if (!textXX.match(regex)){
                  if (textXX.slice(-1) == '['){
                    textX += textXX.slice(0,-1) + "\n";
                  } else {
                    textX += textXX + "\n";
                  }
                }
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
                if (!textXX.match(regex)){
                  if (textXX.slice(-1) == '['){
                    textX += textXX.slice(0,-1) + "\n";
                  } else {
                    textX += textXX + "\n";
                  }
                }
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
              for (let textXX of textArray){
                if (!textXX.match(regex)){
                  if (textXX.slice(-1) == '['){
                    textX += textXX.slice(0,-1) + "\n";
                  } else {
                    textX += textXX + "\n";
                  }
                }

              }
            }
          }
        }
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
