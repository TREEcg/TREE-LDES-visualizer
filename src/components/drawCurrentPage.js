//
//
// this.svgHolder
// this.svgGHolder
// this.remaining (setter)
// dF.jsondata
// this.myGreen
// dF.nodeSpecial (can be imported)
// dF.relationSpecial (can be imported)
//
// on tableclick ctrl
//
// dF.addImportLinks(relationData);
// this.start(relationData.node[0]["@id"]);

import {nodeSpecial, relationSpecial} from './dataFunctions.js'

var svgHolder;
var svgGHolder;
var remainingSetter;
var jsondata;
var myGreen;
var addImportLinks;
var start;
var svgE;
var svgEG;

export function setValues(_svgHolder, _svgGHolder, _remainingSetter, _jsondata, _myGreen, _addImportLinks, _start){
  svgHolder = _svgHolder;
  svgGHolder = _svgGHolder;
  remainingSetter = _remainingSetter;
  jsondata = _jsondata;
  myGreen = _myGreen;
  addImportLinks = _addImportLinks;
  start = _start;
}



export function drawCurrentPage(d){
  svgE = svgHolder[0];
  svgEG = svgGHolder[0];

  svgGHolder[0].selectAll("g").remove();
  // this.remaining = undefined;
  remainingSetter(undefined);
  if (jsondata[d.id] && jsondata[d.id].remainingItems > 0){
    remainingSetter("Remaining items identified via relation properties for selected resource: " + jsondata[d.id].remainingItems + ".\n");
  }

  var newG;
  var tt;

  if (d.relation_count !== undefined){
    newG = svgEG.append("g").attr("class", "new_g");
    tt = newG.append("text");
    expandRelationHolderNodeInfo.call(this, d, tt);
  }

  if (d.relation_count && d.relation_count > 0){
    expandRelationHolder.call(this, d, tt, newG);
  }

  if (d.relation_count !== undefined){
    newG.append("rect").attr("x", 0).attr("y", 0).style("stroke", myGreen)//.style("stroke", "#69b3a2")
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

}



  function expandRelationHolder(d, tt, newG){
    let offH = tt.node().getBBox().height + 30;
    let innerg = newG.append("svg:foreignObject")
      .attr("x", 22)
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
      trX.onclick = tableClick.bind(this, count, jsondata[d.id][count], newG, innerg, table, true)

      for(let valueX of Object.values(dataX)){
        let textX = document.createTextNode(valueX);
        let tdX = trX.insertCell();
        tdX.appendChild(textX);
      }

      trX = tbody.insertRow();
      trX.style.visibility = "collapse";
      trX.id = "large"+count;
      trX.onclick = tableClick.bind(this, count, jsondata[d.id][count], newG, innerg, table, false)

      let textX = document.createTextNode(createExtraCell.call(this, jsondata[d.id][count]));

      let tdX = trX.insertCell();
      tdX.classList.add('spacing');
      tdX.colSpan = tableColumns.length;
      tdX.appendChild(textX);

      count++;
    }

    let bboxT = table.node();
    innerg.attr("width", bboxT.offsetWidth).attr("height", bboxT.offsetHeight);
  }



  function expandRelationHolderNodeInfo(d, tt){
    tt.append("tspan").text(d.type)
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

    for (let pAttr of nodeSpecial){
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
    for (let relX of jsondata[d.id]){
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
      addImportLinks(relationData);
      start(relationData.node[0]["@id"]);
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

    for (let pAttr of relationSpecial){
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
