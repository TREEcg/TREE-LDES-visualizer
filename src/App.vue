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
          <p v-on:click="openShape" style="display:inline">Found a shape, </p>
          <p id="shapeClosed" v-on:click="openShape" style="display:inline; font-weight:bold; cursor: pointer;">click to show.</p>
          <p id="shapeOpenedText" v-on:click="closeShape" style="display:none; font-weight:bold; cursor: pointer;">click to hide.</p>
          <p id="shapeOpened" v-on:click="closeShape" style="display:none;">{{this.shapeInformation}}</p>
          <br>
        </div>
        <div style="min-height:5rem;">
          <p>{{this.identifies}}</p>
          <p>{{this.remaining}}</p>
          <p>{{this.remainingMembers}}</p>
        </div>
      </div>
    </div>

    <div v-if="this.data_url">


      <div class="flexContainer">
        <!-- <div id="currentPage" class="textContent"> -->
          <!-- <h3>Selected resource</h3> -->
        <!-- </div> -->
        <div class="textContent resizableContainers">
          <h3>Selected resource</h3>
          <div id="currentPage"></div>
        </div>
        <div class="textContent resizableContainers">
          <h3>Graph</h3>
          <div id="graph"></div>
        </div>
      </div>
      <div class="flexContainer">
        <!-- <div id="members" class="textContent">
          <h3>Members</h3>
        </div> -->
        <div class="textContent resizableContainers">
          <h3>Members</h3>
          <div id="members"></div>
        </div>

        <div class="textContent resizableContainers">
          <h3>Log</h3>
          <!-- <div id="currentPage"></div> -->


        <div id="log" class="textContent">
          <!-- <h3>Log</h3> -->

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
import * as dG from './components/drawGraph.js';

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
      myGreen: "rgba(0, 128, 0, 0.5)",
      tableObserver: undefined
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
  mounted(){
    this.startObserver();
  },
  methods : {

    // url = undefined & this.data_url defined if you wish to start a new collection
    // url = undefined will also reset the path save in the page url
    startObserver(){
      // This fixes the size off the table showing relations etc.
      if (this.tableObserver){
        this.tableObserver.disconnect();
      } else {
        this.tableObserver = new ResizeObserver(function(){
          if (document.getElementById("currentPage") && document.getElementById("currentPage").offsetWidth){
            dP.updateWidth(document.getElementById("currentPage").offsetWidth);
          }
        });
      }
      if (document.getElementById("currentPage")){
        this.tableObserver.observe(document.getElementById("currentPage"));
      }

    },
    start(url){
      this.derefUrl(url);

      if (!url && dF.data_url){
        window.history.pushState({}, document.title, this.emptyURL+"?p="+encodeURIComponent(dF.data_url));
        this.urlList = [dF.data_url];
      } else if (dF.data_url && !this.urlList.includes(dF.data_url) && (window.location.toString().length + 3 + encodeURIComponent(dF.data_url).length) < 2000){
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
      this.startObserver();
    },
    svgClear(){
      this.rootInfo = undefined;
      this.mainInfo = undefined;
      this.shapePresent = undefined;
      this.shapeInformation = undefined;
      this.identifies = undefined;
      this.remaining = undefined;
      this.remainingMembers = undefined;
      this.collectionStats = {};
      d3.selectAll("div").selectAll("svg").remove();
      this.svgHolder = null;
      this.svgGHolder = null;
    },
    cB(){
      this.copyData();
      this.setSVGElements();

      if (!this.findLastNode(dF.data_url)){
        let tempArray = Array.from(dF.redirectMappings.get(dF.data_url));
        while(tempArray.length > 0 && !this.findLastNode(tempArray.pop())){return;}
      }

      this.mainInfo = dF.mainInfo;
      this.rootInfo = dF.rootInfo;

      if (dF.jsondata.shapes && dF.jsondata.shapes[0] && dF.jsondata.shapes[0]["shape_extra"]){
        this.shapeInformation = dF.jsondata.shapes[0]["shape_extra"];
        this.shapePresent = true;
      } else {
        this.shapePresent = undefined;
      }

      dG.setValues(this.myGreen, dF.jsondata, dP.drawCurrentPage, dM.drawMembers, "graph", dF.relationLabelMap, this.start);
      dG.drawGraph();
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
      dP.setValues(this.svgHolder, this.svgGHolder, this.remainingSetter, dF.jsondata, dF.addImportLinks, this.start);
      dP.drawCurrentPage(d);
      dM.setValues(dF.members, dF.membersFailed, this.remainingMembersSetter, dF.node_validation, "members")
      dM.drawMembers(d);
    },
    setSVGElements(){
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

/* #currentPage, #graphHolder, #members, #log {
  height: 50vh;
  resize: both;
  overflow:auto;
  width: 40%;
  margin-left: 7%;
  margin-top: 3.5vh;
} */

#currentPage, #graph, #members, #log {
  flex-grow: 1;
  background-color: rgba(0, 0, 0, 0.02);
  overflow:auto;
  padding-bottom: 22px;
}

/* #currentPage {

} */

.resizableContainers {
  height: 50vh;
  resize: both;
  overflow:auto;
  width: 40%;
  margin-left: 7%;
  margin-top: 3.5vh;
  display: flex;
  flex-direction: column;
}

/* #graphHolder {
  display: flex;
  flex-direction: column;
}

#currentPage{

}
#graph{
  flex-grow: 1;
  background-color: rgba(0, 0, 0, 0.02);
  /* height: 100%; */
  /* width: 100%; */
/* }
#members{

}
#log{

} */

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


#graph > svg > g {
  cursor: pointer;
}

#members > details {
  white-space: pre;
  margin-bottom: 1.5rem;
}

.failedMember {
  color: red;
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
  white-space: pre-wrap;
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

.tableTextContainer {
  max-width: 100%;
  overflow-wrap: break-word;
  white-space: pre-wrap;
  white-space: -moz-pre-wrap;
  white-space: -pre-wrap;
  white-space: -o-pre-wrap;
  word-wrap: break-word;
}

table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  /* max-width: 80%; */
}

td > button {
  margin-right: 4px;
}

tr {
  overflow-wrap: break-word;
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
