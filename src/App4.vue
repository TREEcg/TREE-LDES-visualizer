<template>
  <!-- <myHeader></myHeader> -->
  <h1>Visualizer</h1>
  <div id="visualizerContainer">
    <div class="textContent">
      <h2>A tool to visualize and validate a tree:collection</h2>

      <div>
        <label style="vertical-align: top;" for="url">Enter URL: </label>
        <div id="examplesDiv" style="margin: auto; display: inline-block; vertical-align: top;">
          <input type="url" list="exT" v-model="data_url" placeholder="URL" name="url" v-on:click.stop="open()" v-on:keyup.enter="start(undefined)" v-on:blur="close()">
          <ul id="fakeExamples" tabindex="1" v-on:blur="close()">
            <li v-on:mousedown="setUrl(valueX)" v-for="[keyX, valueX] in this.exampleMap" v-bind:key="keyX" :title=valueX>
              {{keyX}}
            </li>
          </ul>
        </div>
        <button style="vertical-align: top; margin-left: 4px; margin-top: 1px;" v-on:click="start(undefined)">Go</button>
      </div>


      <div id="information" style="white-space: pre">
        <br>
        <p>{{this.rootInfo}}</p>
        <p>{{this.mainInfo}}</p>
        <li v-for="[keyX, valueX] in Object.entries(this.collectionStats)" v-bind:key="keyX">
          {{keyX}}: {{valueX}}
        </li>
        <div v-if="this.shapePresent" style="display:inline-block; margin-bottom:1rem;">
          <p v-on:click="openShape" style="display:inline">Found a shape</p>
          <p id="shapeClosed" v-on:click="openShape" style="display:inline">, click to show.</p>
          <p id="shapeOpenedText" v-on:click="closeShape" style="display:none">, click to hide.</p>
          <p id="shapeOpened" v-on:click="closeShape" style="display:none;">{{this.shapeInformation}}</p>
          <br>
        </div>
        <p>{{this.identifies}}</p>
        <p>{{this.remaining}}</p>
        <p>{{this.remainingMembers}}</p>
      </div>
    </div>

    <div v-if="this.data_url">


      <div class="flexContainer">
        <div id="currentPage" class="textContent"></div>
        <div id="graph" style="overflow:scroll; resize: both;"></div>
      </div>
      <div class="flexContainer">
        <div id="members" class="textContent">
          <p>Members:</p>
        </div>

        <div id="log" class="textContent">

          <div id="v-model-radiobutton">
            <input type="radio" id="one" value="Remarks" v-model="picked" />
            <label for="one">Remarks</label>
            <br />
            <input type="radio" id="two" value="Shape" v-model="picked" />
            <label for="two">Shape Validation</label>
            <br />
          </div>

          <div>
            <div v-if="picked === 'Shape'">
              <div v-if="this.shape_validation == false || this.shape_validation == true">
                <br><p>All members conform to shape: {{this.shape_validation}}</p>
              </div>
              <div v-if="this.shape_report">
                <div style="white-space: pre-line">{{this.shape_report}}</div>
              </div>
              <div v-else>
                <p>No report available.</p>
              </div>
            </div>
          </div>

          <div v-if="picked === 'Remarks'">
            <div v-if="this.remarks">
              <div style="white-space: pre-line">{{this.remarks}}</div>
            </div>
            <div v-else>
              <p>No remarks available.</p>
            </div>
          </div>

        </div>
      </div>
      <!-- This empty div allows user to resize extra info screen easily -->
      <div style="height: 100px;"></div>
    </div>

  </div>
  <!-- <myFooter></myFooter> -->
</template>


<script>

import * as d3 from "d3";
import * as dF from './components/dataFunctions.js';
import * as dP from './components/drawCurrentPage.js';
import * as dM from './components/drawCurrentMembers.js';

// import header from './components/header.html'
// import footer from './components/footer.html'
// import footer from 'https://raw.githubusercontent.com/TREEcg/site/master/_includes/footer.html'

/*
POSSIBLE TODO OVERVIEW
  Get rid of using multiple nested promises as a way to observe function completion, I hate myself for coding that stuff
  show what members actually got validated, member might not have correct attributes targeted by shape
  support for multiple collections at the same URL?
  support for multiple nodes at the same URL?
  support for working importStream
    this means adding it to function addImportLinks(data)
  support for working tree:search
  conditionalImport now gets imported without checking conditions
    this means adding a check at function addImportLinks(data)
*/

export default {
  name: 'App',
  components: {
    // 'myHeader':header,
    // 'myFooter':footer
  },
  data(){
    return {
      exampleMap: new Map([
        ["Streets of Flemish Address Registry", "https://tree.linkeddatafragments.org/data/addressregister/streetnames/"],
        ["Visual Thesaurus for Fashion & Costumes", "https://treecg.github.io/demo_data/vtmk.ttl"],
        ["Municipalities of Flemish Address Registry", "https://tree.linkeddatafragments.org/data/addressregister/municipalities/"],
        ["Cultural Historic Thesaurus", "https://treecg.github.io/demo_data/cht.ttl"],
        ["Public Transport Stops in Flanders", "https://treecg.github.io/demo_data/stops.ttl"],
        ["Digital Heritage Fragments about WW2", "https://demo.netwerkdigitaalerfgoed.nl/fragments/wo2/"],
        ["Demo data Shacl validation", "https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/cht_1_2.ttl"],
        ["Demo data Import statements", "https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testerMultipleImports.ttl"],
        ["Demo data ldes stream", "https://graph.irail.be/sncb/connections/feed"]
      ]),
      svgHolder: null,
      svgGHolder: null,
      remarks: "",
      next_url: "",
      checked_shape: false,
      checked_remarks: false,
      picked: 'Remarks',
      graph_height: 600,
      graph_width: 1000,
      data_url: undefined,
      shape_validation: null,
      node_validation: [],
      shape_report: "",
      selected: 0,
      alpha_decay_rate: 0.5,//1 - Math.pow(0.001, 1 / 300)
      emptyURL: "",
      urlList: [],
      rootInfo: "",
      mainInfo: "",
      remaining: "",
      remainingMembers: "",
      identifies: "",
      collectionStats: {},
      shapeInformation: "",
      shapePresent: undefined,
      myGreen: "rgba(0, 128, 0, 0.5)"
    }
  },
  watch: {
    picked: {
      handler() {
        this.remarks = dF.remarks;
      },
    }
  },

  created() {
    var listUrl = ("" + window.location).split('?p=');
    this.urlList = JSON.parse(JSON.stringify(listUrl));
    this.emptyURL = listUrl.shift();
    listUrl = listUrl.map(v => decodeURIComponent(v));
    if (listUrl.length > 0){
      const lastUrl = listUrl.pop();
      dF.clearData();
      if (listUrl.length > 0){
        var promiseResolve;
        var p = new Promise(function(resolve){
          promiseResolve = resolve;
        });
        this.derefList(listUrl.shift(), listUrl, promiseResolve);

        p.then(() => this.derefUrl(lastUrl));
      } else {
        this.derefUrl(lastUrl);
      }
    }
  },
  methods : {

    // url = undefined & this.data_url defined if you wish to start a new collection
    // url = undefined will also reset the path save in the page url
    start(url){
      this.derefUrl(url);

      if (!url && dF.data_url){
        window.history.pushState({}, document.title, this.emptyURL+"?p="+encodeURIComponent(dF.data_url));
        this.urlList = [dF.data_url];
      } else if (dF.data_url && !this.urlList.includes(dF.data_url)){
        window.history.pushState({}, document.title, window.location+"?p="+encodeURIComponent(dF.data_url));
        this.urlList.push(dF.data_url);
      } else if (!dF.data_url){
        window.history.pushState({}, document.title, this.emptyURL);
        this.urlList = [];
      }

    },
    derefList(url, list, promiseResolve){
      var promiseResolve1;
      var p1 = new Promise(function(resolve){
        promiseResolve1 = resolve;
      });

      var promiseResolve2;
      var p2 = new Promise(function(resolve){
        promiseResolve2 = resolve;
      });

      var promiseResolve3;
      var p3 = new Promise(function(resolve){
        promiseResolve3 = resolve;
      });
      dF.getData(url, promiseResolve1, promiseResolve2, undefined, promiseResolve3)
      Promise.all([p1, p2, p3]).then(() => {
        if (list.length == 0){
          promiseResolve();
        } else {
          this.derefList(list.shift(), list, promiseResolve);
        }
      });
    },
    derefUrl(url){
      if (!url && !this.data_url){
        this.svgClear();
        dF.setDataUrl(undefined);
        alert("Please define a starting point");
        return;
      }

      var promiseResolve1;
      var p1 = new Promise(function(resolve){
        promiseResolve1 = resolve;
      });

      var promiseResolve2;
      var p2 = new Promise(function(resolve){
        promiseResolve2 = resolve;
      });

      if (url){
        this.data_url = url;
      }

      dF.setDataUrl(this.data_url);
      dF.getData(url, promiseResolve1, promiseResolve2, this.svgClear, this.collectionCB);
      Promise.all([p1,p2]).then(() => this.cB())
    },
    validateAll(){
      dF.setDataUrl(this.data_url);
      dF.validateAll(this.data_url, this.cB);
    },
    copyData(){
      this.remaining = undefined;
      this.data_url = dF.data_url;
      this.shape_validation = dF.shape_validation;
      this.node_validation = dF.node_validation;
      this.shape_report = dF.shape_report;
      this.collectionStats = dF.collectionStats;
      this.remarks = dF.remarks;
      this.mainInfo = dF.mainInfo;
      this.rootInfo = dF.rootInfo;
    },
    svgClear(){
      this.rootInfo = undefined;
      this.mainInfo = undefined;
      this.shapePresent = undefined;
      this.shapeInformation = undefined;
      this.identifies = undefined;
      this.remaining = undefined;
      this.remainingMembers = undefined;
      d3.selectAll("div").selectAll("svg").remove();
      this.svgHolder = null;
      this.svgGHolder = null;
    },
    cB(){
      this.copyData();

      if (!this.findLastNode(dF.data_url)){
        if (dF.myMetadata.nodes && dF.myMetadata.nodes.size > 0){
          this.findLastNode(Array.from(dF.myMetadata.nodes.keys())[0])
        }
      }

      this.mainInfo = dF.mainInfo;
      this.rootInfo = dF.rootInfo;

      if (dF.jsondata.shapes && dF.jsondata.shapes[0] && dF.jsondata.shapes[0]["shape_extra"]){
        this.shapeInformation = dF.jsondata.shapes[0]["shape_extra"];
        this.shapePresent = true;
      } else {
        this.shapePresent = undefined;
      }

      this.drawGraph();
    },
    findLastNode(lastUrl){
      let found = false;
      if (dF.jsondata.nodes.length > 0){
        for (let n of dF.jsondata.nodes){
          if (n.name == lastUrl){
            n.selected = true;
            this.drawExtra(n);
            found = true;
            if (dF.jsondata[n.id] && dF.jsondata[n.id].remainingItems > 0){
              this.remaining = "Remaining items identified via relation properties for selected resource: " + dF.jsondata[n.id].remainingItems + ".\n";
            }
            this.identifies = "Selected resource identifies a node.\n";
          } else {
            n.selected = false;
          }
        }
      }

      if (dF.jsondata.views.length > 0){
        for (let n of dF.jsondata.views){
          if (n.name == lastUrl){
            n.selected = true;
            this.drawExtra(n);
            found = true;
            if (dF.jsondata[n.id] && dF.jsondata[n.id].remainingItems > 0){
              this.remaining = "Remaining items identified via relation properties for selected resource: " + dF.jsondata[n.id].remainingItems + ".\n";
            }
            this.identifies = "Selected resource identifies a view.\n";
          } else {
            n.selected = false;
          }
        }
      }
      return found;
    },
    collectionCB(){
      this.collectionStats = dF.collectionStats;
      this.remarks = dF.remarks;
      this.mainInfo = dF.mainInfo;
      this.rootInfo = dF.rootInfo;
    },
    setUrl(value){
      this.data_url = value;
      this.start(undefined);
    },
    close(){
      document.getElementById("fakeExamples").style.display = "none";
    },
    open(){
      document.getElementById("fakeExamples").style.display = "inline-block";
    },
    openShape(){
      document.getElementById("shapeClosed").style.display = "none";
      document.getElementById("shapeOpenedText").style.display = "inline";
      document.getElementById("shapeOpened").style.display = "block";
    },
    closeShape(){
      document.getElementById("shapeClosed").style.display = "inline";
      document.getElementById("shapeOpenedText").style.display = "none";
      document.getElementById("shapeOpened").style.display = "none";
    },
    remainingSetter(str){
      this.remaining = str;
    },
    remainingMembersSetter(str){
      this.remainingMembers = str;
    },

    drawExtra(d){
      if (!this.svgHolder){
        this.svgHolder =
        [
          d3.select("#currentPage")
          .append("svg")
          .attr("pointer-events", "all"),
          d3.select("#members")
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
      }

      dP.setValues(this.svgHolder, this.svgGHolder, this.remainingSetter, dF.jsondata, this.myGreen, dF.addImportLinks, this.start);
      dP.drawCurrentPage(d);
      dM.setValues(this.svgHolder, this.svgGHolder, dF.members, dF.membersFailed, this.remainingMembersSetter, dF.node_validation)
      dM.drawMembers(d);
    },




    drawGraph() {
      const margin = {top: 10, right: 30, bottom: 10, left: 30};

      const width = this.graph_width - margin.left - margin.right;
      const height = this.graph_height - margin.top - margin.bottom;

      const drawCurrentPageBound = (d) => dP.drawCurrentPage.bind(this)(d);
      const drawMembersBound = (d) => dM.drawMembers.bind(this)(d);

      //clear the graph on redrawing
      d3.select("#graph").selectAll("svg").remove();

      const linkData = [];
      dF.jsondata.links.forEach((s, k) => {s.forEach(v => linkData.push({"source":k,"target":v}))});

      let targets = linkData.map(v => v.target);
      //Every node should have a link that ends in that node, if not connect it to the collection
      dF.jsondata.nodes.forEach(v => {
        if (!targets.includes(v.id)){
          linkData.push({"source":dF.jsondata.collection[0].id,"target":v.id,"fakeLink":true});
        }
      });


      // console.log("linkData: ", linkData);
      var all = dF.jsondata.collection.concat(dF.jsondata.shapes.concat(dF.jsondata.nodes.concat(dF.jsondata.views)));

      // append the svg object to the body of the page
      const svg = d3.select("#graph")
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("pointer-events", "all");

      // The event.transform does not change during session, it simply gets added onto every time
      // So just safe the value on the main svg so we can use it in calculations
      // We can't use this with transform directly because links depend on actual x and y data, not the translated attributes
      svg.attr("prevTX", 0).attr("prevTY", 0).attr("scaleAllX", 1);


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
      .style('stroke-dasharray', function(d){
        if (d.fakeLink){
          return '10, 5';
        }
        return '10, 0';
      })
      .attr("marker-mid", "url(#arrow)" );


      if (dF.jsondata.collection.length > 0){
        const collection = svg
        .selectAll("gcollection")
        .data(dF.jsondata.collection)
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
        // .style("stroke", "#5fd145")
        .style("stroke", "#2cbe16")
        .lower();
      }

      if (dF.jsondata.views.length > 0){
        const view = svg
        .selectAll("gview")
        .data(dF.jsondata.views)
        .join("g")
        .attr("class", "view_g main_g")
        .on("click", function(e, d) {
          svg.selectAll("rect").style("stroke-width", "1");
          drawCurrentPageBound(d);
          drawMembersBound(d);
          d3.select(this).selectAll("rect").style("stroke-width", "3");
        })
        .call(d3.drag()
        .on("start", dragstartX)
        .on("end", dragendX)
        .on("drag", dragX));

        view.append("text")
        .attr("text-anchor", "start")
        .attr("class", "view_text main_text")
        .attr("dx", 5)
        .attr("dy",20)
        .text("")
        .raise();

        for (let tg of d3.selectAll(".view_g")){
          d3.select(tg).select("text")
          .append("tspan").text(function(d){return d.type})
          .attr("dx",5);

          d3.select(tg).select("text")
          .append("tspan").text(function(d){
            if (d.name.length > 25){
              return d.name.slice(0,18)+"..."+d.name.slice(-5);
            }
            return d.name
          })
          .attr("dx",5)
          .append("title").text(function(d){return d.name})

          d3.select(tg).select("text")
          .append("tspan").text(function(d){
            if (d.relation_count !== undefined){
              return "relations: " + d.relation_count;
            } else {
              return "View not loaded yet"
            }

          })
          .attr("dx",15);

          d3.select(tg).selectAll("tspan").attr("x", 0).attr("dy", 22);

          d3.select(tg).append("rect")
          .attr("class", "view_rect main_rect")
          .attr("width", d3.select(tg).select("text").node().getBBox().width+15)
          .attr("height", d3.select(tg).select("text").node().getBBox().height+10)
          // .style("stroke", "#69b3a2")
          .style("stroke", this.myGreen)
          .style('stroke-dasharray', '10,5')
          .style('stroke-linecap', 'butt')
          .style("stroke-width", function(d){
            if (d.selected){
              return "3";
            } else {
              return "1";
            }
          })
          .lower();
        }
      }



      if (dF.jsondata.shapes.length > 0){
        const shape = svg
        .selectAll("gshape")
        .data(dF.jsondata.shapes)
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



      if (dF.jsondata.nodes.length > 0){
        const node = svg
        .selectAll("gnode")
        .data(dF.jsondata.nodes)
        .join("g")
        .attr("class", "node_g main_g")
        .on("click", function(e, d) {
          svg.selectAll("rect").style("stroke-width", "1");
          drawCurrentPageBound(d);
          drawMembersBound(d);
          d3.select(this).selectAll("rect").style("stroke-width", "3");
        })
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
          .append("tspan").text(function(d){return d.type})
          .attr("dx",5);

          d3.select(tg).select("text")
          .append("tspan").text(function(d){
            if (d.name.length > 25){
              return d.name.slice(0,18)+"..."+d.name.slice(-5);
            }
            return d.name
          })
          .attr("dx",5)
          .append("title").text(function(d){return d.name})

          d3.select(tg).select("text")
          .append("tspan").text(function(d){return "relations: " + d.relation_count})
          .attr("dx",15);

          d3.select(tg).selectAll("tspan").attr("x", 0).attr("dy", 22);

          d3.select(tg).append("rect")
          .attr("class", "node_rect main_rect")
          .attr("width", d3.select(tg).select("text").node().getBBox().width+15)
          .attr("height", d3.select(tg).select("text").node().getBBox().height+10)
          // .style("stroke", "#69b3a2")
          .style("stroke", this.myGreen)
          .style('stroke-dasharray', '10,5')
          .style('stroke-linecap', 'butt')
          .style("stroke-width", function(d){
            if (d.selected){
              return "3";
            } else {
              return "1";
            }
          })
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
        link.attr("transform", "scale("+svg.attr("scaleAll")+")");
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

      // d3 sees zooming and panning as the same thing, strange design choice
      const zoom = d3.zoom()

      //while panning links wont move because we use translate instead of changing x and y
      zoom.on("zoom", function(e) {
        d3.selectAll(".main_g")
        .attr("transform", function(){return "translate("+(e.transform.x - svg.attr("prevTX"))+","+(e.transform.y - svg.attr("prevTY"))+")scale("+e.transform.k+")"});

        fixLinks();
        link.attr("transform", function(){return "translate("+(e.transform.x - svg.attr("prevTX"))+","+(e.transform.y - svg.attr("prevTY"))+")scale("+e.transform.k+")"});
      });

      // At the end of a zoom we only keep scale attribute and calculate the correct x and y attributes based of the translation
      zoom.on("end", function(e) {
        d3.selectAll(".main_g")
        .attr("x", function(d) { d.x += e.transform.x*(1/e.transform.k) - svg.attr("prevTX")*(1/e.transform.k)})
        .attr("y", function(d) { d.y += e.transform.y*(1/e.transform.k) - svg.attr("prevTY")*(1/e.transform.k)})
        .attr("transform", function(){return "scale("+e.transform.k+")"});


        svg.attr("prevTX", e.transform.x).attr("prevTY", e.transform.y).attr("scaleAll", e.transform.k);

        fixGroupChildren()
        fixLinks();
      });

      // connect the zoom function to the main svg element
      svg.call(zoom);


      function clickCollection(e, d){
        let currentg = d3.select(e.target.parentNode);
        if (!currentg.classed("collection_g")){
          currentg = d3.select(currentg._groups.pop().pop().parentNode);
        }

        expandCollection.call(this,currentg, d);

        ticked();
      }

      function expandCollection(currentg, d){
        if(currentg.attr("expanded") == "false"){
          currentg.attr("expanded", "true");

          expandCollectionTrue.call(this,currentg, d);

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

        for (let pAttr of dF.collectionSpecial){
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

        tt.selectAll("tspan").attr("dy", 22).attr("x",0);

        currentg.select("rect")
        .attr("height", 10 + currentg.select("text").node().getBBox().height)

        currentg.select("rect").attr("width", currentg.select("text").node().getBBox().width + 10);
      }


      function clickShape(e, d){
        let currentg = d3.select(e.target.parentNode);
        if (!currentg.classed("shape_g")){
          currentg = d3.select(currentg._groups.pop().pop().parentNode);
        }

        expandShape.call(this,currentg, d);
        ticked();
      }

      function expandShape(currentg, d){
        if(currentg.attr("expanded") == "false"){
          currentg.attr("expanded", "true");

          expandShapeTrue.call(this,currentg, d);

        } else {
          currentg.attr("expanded", "false");

          currentg.select("text").text((d.type + "").split('#').pop())

          currentg.select("rect")
          .attr("height", 30)
          .attr("width", currentg.select("text").node().getBBox().width + 10);
        }
      }

      function expandShapeTrue(currentg, d){
        currentg.raise();

        let textArray = d.shape_extra.split('\n');

        currentg.select("text").text("");

        for (let textX of textArray){
          let indent = (textX.split('\t').length -1) * 20;
          currentg.select("text").append('tspan')
          .text(textX.replace('\t',''))
          .attr("dy", 20)
          .attr("dx", indent + 5);
        }
        currentg.select("text").selectAll("tspan").attr("x",0);
        currentg.select("rect")
        .attr("height", currentg.select("text").node().getBBox().height + 10)
        .attr("width", currentg.select("text").node().getBBox().width + 10);
      }


    }

  }

}

</script>


<style>
/* #app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
} */

/* #visualizerContainer {
  position: inherit;
  padding-left: -1000px;
  margin-left: -1000px;
  left: 0;
} */

/* #visualizerContainer:after {
  content: " ";
  padding-bottom: 1000px;
} */

/* body {
  max-width: 100vw;
} */

/* #extra {
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
} */


#fakeExamples {
  margin: 0 0 0 0;
  padding: 1px 0 0 0;
  text-align: left;
  list-style-type: none;
  width: 100%;
  display: none;
}

#fakeExamples > li {
  width: 100%;
  border-bottom-style: solid;
  border-left-style: solid;
  border-right-style: solid;
  border-width: 1px;
}

#fakeExamples > li:hover {
  background-color: #dcdcf7;
}

#examplesDiv {
  width: 500px;
}

#examplesDiv > input {
  width: 100%;
  padding: 0 0 0 0;
  width: 100%;
  border-bottom-style: solid;
  border-left-style: solid;
  border-right-style: solid;
  border-width: 1px;
}

/* <div id="currentPage"></div>
<div id="graph" style="overflow:scroll; resize: both;"></div>
<div id="members"></div>
<div id="log"></div> */

#currentPage, #graph, #members, #log {
  height: 50vh;
  resize: both;
  overflow:scroll;
  width: 40%;
  margin-left: 7%;
  margin-top: 3.5vh;
}

#currentPage{

}
#graph{

}
#members{

}
#log{

}

#information {
  margin: .75em 0 .75em 0;
  min-height: 10em;
  list-style-type: none;
}

#information > p {
  margin: 0 0 0 0;
}

.flexContainer {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  width: 98vw;
  margin-left: calc(-50vw + 430px);
  /* justify-content: space-evenly; */
}

/* .container {
  margin-bottom: 10px;
  position: sticky;
  left: 0%;
} */

/* .divFloat {
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
} */

/* .close {
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
}*/
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
  text-align: left;
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
