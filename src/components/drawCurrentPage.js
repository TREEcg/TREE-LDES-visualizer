import {nodeSpecial, relationSpecial} from './dataFunctions.js'

var svgHolder;
var svgGHolder;
var remainingSetter;
var jsondata;
var addImportLinks;
var start;
var members;
var svgE;
var svgEG;
var offH;
var tt;

export function setValues(_svgHolder, _svgGHolder, _remainingSetter, _jsondata, _addImportLinks, _start, _members){
  svgHolder = _svgHolder;
  svgGHolder = _svgGHolder;
  remainingSetter = _remainingSetter;
  jsondata = _jsondata;
  addImportLinks = _addImportLinks;
  start = _start;
  members = _members;
}

// Now that this is separate from the actual graph this should be changed to plain HTML and not use svg's & d3 stuff.

export function drawCurrentPage(d){
  svgE = svgHolder[0];
  svgEG = svgGHolder[0];

  svgGHolder[0].selectAll("g").remove();
  remainingSetter(undefined);
  if (jsondata[d.id] && jsondata[d.id].remainingItems > 0){
    remainingSetter("Remaining items identified via relation properties for selected resource: " + jsondata[d.id].remainingItems + ".\n");
  }

  var newG;

  if (d.relation_count !== undefined){
    newG = svgEG.append("g").attr("class", "new_g");
    tt = newG.append("text");
    expandRelationHolderNodeInfo.call(this, d, tt);
  }

  if (d.relation_count && d.relation_count > 0){
    expandRelationHolder.call(this, d, tt, newG);
  }

  if (d.relation_count !== undefined){
    // Make the main svg holding this large enough to show everything
    let bbox = svgEG.node().getBBox();
    svgE.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
    .attr("width", (bbox.width+bbox.x))
    .attr("height", (bbox.height+bbox.y));
  }
}

export function updateWidth(width){
  if (document.getElementById("currentPageTableHolder")){

    document.getElementById("currentPageTableHolder").setAttribute("width", width-60);
    let newHeight = document.getElementById("currentPageTable").offsetHeight;
    document.getElementById("currentPageTableHolder").setAttribute("height", newHeight);

    let bbox = svgEG.node().getBBox();
    svgE.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
    .attr("width", (bbox.width+bbox.x))
    .attr("height", (bbox.height+bbox.y));
  }
}



function expandRelationHolder(d, tt, newG){
  offH = tt.node().getBBox().height + 30;
  let widthBox = document.getElementById('currentPage').getBoundingClientRect().width;
  let innerg = newG.append("svg:foreignObject")
  .attr("id", "currentPageTableHolder")
  .attr("x", 22)
  .attr("y", offH)
  .attr("width", widthBox-60)
  .attr("height", 600);

  var table = innerg.append('xhtml:table').attr("id", "currentPageTable");
  var thead = table.append('thead');
  var	tbody = table.append('tbody').attr("id", "my_tbody");

  var tableColumns = ["type", "value", "path"];
  var tableData = parseTableData.call(this, d);

  let theadRow = thead.append('tr');
  // append the header row
  theadRow.selectAll('th')
  .data(tableColumns).enter()
  .append('th')
  .text(function (column) { return column; });

  theadRow.append('th').text("");


  tbody = document.getElementById("my_tbody")

  let count = 0;
  for (let dataX of tableData){
    let trX = tbody.insertRow();
    trX.id = "small"+count;

    for(let valueX of Object.values(dataX)){
      let textX = document.createTextNode(valueX);
      let tdX = trX.insertCell();
      tdX.appendChild(textX);
    }

    let tdX = trX.insertCell();
    let btnExpand = document.createElement("button");
    btnExpand.onclick = tableClick.bind(this, count, jsondata[d.id][count], newG, innerg, table, true);
    btnExpand.innerHTML = "Expand"
    tdX.appendChild(btnExpand);
    let btnFollow = document.createElement("button");
    btnFollow.innerHTML = "Follow"
    btnFollow.setAttribute("count", count);
    btnFollow.onclick = function(){
      addImportLinks(jsondata[d.id][this.getAttribute("count")]);
      start(jsondata[d.id][this.getAttribute("count")].node[0]["@id"]);
    };
    tdX.appendChild(btnFollow);

    trX = tbody.insertRow();
    trX.style.visibility = "collapse";
    trX.id = "large"+count;

    let textX = document.createTextNode(createExtraCell.call(this, jsondata[d.id][count]));
    let containerDiv = document.createElement("div");
    containerDiv.classList.add('tableTextContainer');
    containerDiv.appendChild(textX);

    tdX = trX.insertCell();
    tdX.classList.add('spacing');
    tdX.colSpan = tableColumns.length + 1;
    tdX.appendChild(containerDiv);

    let btnCollapse = document.createElement("button");
    btnCollapse.onclick = tableClick.bind(this, count, jsondata[d.id][count], newG, innerg, table, false);
    btnCollapse.innerHTML = "Collapse"
    tdX.appendChild(btnCollapse);
    let btnFollowC = document.createElement("button");
    btnFollowC.innerHTML = "Follow"
    btnFollowC.setAttribute("count", count);
    btnFollowC.onclick = function(){
      addImportLinks(jsondata[d.id][this.getAttribute("count")]);
      start(jsondata[d.id][this.getAttribute("count")].node[0]["@id"]);
    };
    tdX.appendChild(btnFollowC);

    count++;
  }

  let bboxT = table.node();
  innerg.attr("width", bboxT.offsetWidth).attr("height", bboxT.offsetHeight);
}

function expandRelationHolderNodeInfo(d, tt){
  tt.append("tspan").text(d.type)
  .attr("dy", 22)
  .attr("dx",5);

  tt.append("tspan").text(function(){
    if (d.name.length > 70){
      return d.name.slice(0,45)+"..."+d.name.slice(-15);
    }
    return d.name
  })
  .attr("dy", 22)
  .attr("x",0)
  .attr("dx",5)
  .on("click", function(){navigator.clipboard.writeText(d.name);})
  .append("title").text("Click to copy link\n" + d.name);

  tt.append("tspan").text("relations: " + d.relation_count)
  .attr("dy", 22)
  .attr("x",0)
  .attr("dx",15);

  let totalMembers = 0;
  if(members[d.name] && members[d.name].size > 0) {
    totalMembers = members[d.name].size;
  }

  tt.append("tspan").text("members: " + totalMembers)
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

  let bboxT = table.node();
  innerg.attr("width", bboxT.offsetWidth).attr("height", bboxT.offsetHeight);

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
