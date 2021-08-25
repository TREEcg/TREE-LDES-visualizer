import * as d3 from "d3";
import {collectionSpecial} from './dataFunctions.js'

var myGreen;
var alpha_decay_rate = 0.5;
var jsondata;
var drawCurrentPage;
var drawMembers;
var svg;
var link;
var parentIdString;

export function setValues(_myGreen, _jsondata, _drawCurrentPage, _drawMembers, _parentIdString){
  myGreen = _myGreen;
  jsondata = _jsondata;
  drawCurrentPage = _drawCurrentPage;
  drawMembers = _drawMembers;
  parentIdString = _parentIdString;
}


export function drawGraph() {
  const width = document.getElementById(parentIdString).offsetWidth;
  const height = document.getElementById(parentIdString).offsetHeight;

  const drawCurrentPageBound = (d) => drawCurrentPage(d);
  const drawMembersBound = (d) => drawMembers(d);

  //clear the graph on redrawing
  d3.select("#"+parentIdString).selectAll("svg").remove();

  const linkData = [];
  jsondata.links.forEach((s, k) => {s.forEach(v => linkData.push({"source":k,"target":v}))});

  let targets = linkData.map(v => v.target);
  //Every node should have a link that ends in that node, if not connect it to the collection
  jsondata.nodes.forEach(v => {
    if (!targets.includes(v.id)){
      linkData.push({"source":jsondata.collection[0].id,"target":v.id,"fakeLink":true});
    }
  });


  // console.log("linkData: ", linkData);
  var all = jsondata.collection.concat(jsondata.shapes.concat(jsondata.nodes.concat(jsondata.views)));
  // append the svg object to the body of the page
  svg = d3.select("#"+parentIdString)
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


  link = svg.selectAll(".edgepath")
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


  if (jsondata.collection.length > 0){
    const collection = svg
    .selectAll("gcollection")
    .data(jsondata.collection)
    .join("g")
    .attr("class", "collection_g main_g")
    .attr("expanded", "false")
    .on("click", clickCollection)
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

  if (jsondata.views.length > 0){
    const view = svg
    .selectAll("gview")
    .data(jsondata.views)
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
      .style("stroke", myGreen)
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



  if (jsondata.shapes.length > 0){
    const shape = svg
    .selectAll("gshape")
    .data(jsondata.shapes)
    .join("g")
    .attr("class", "shape_g main_g")
    .attr("expanded", "false")
    .on("click", clickShape)
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



  if (jsondata.nodes.length > 0){
    const node = svg
    .selectAll("gnode")
    .data(jsondata.nodes)
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
      .style("stroke", myGreen)
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
  .links(linkData))
  .force("center", d3.forceCenter(width / 2, height / 2))
  .force("collide", d3.forceCollide(100))
  .alphaDecay(alpha_decay_rate)
  .on("end", firstTick);




  // d3 sees zooming and panning as the same thing, strange design choice
  const zoom = d3.zoom();

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
}

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


function clickCollection(e, d){
  let currentg = d3.select(e.target.parentNode);
  if (!currentg.classed("collection_g")){
    currentg = d3.select(currentg._groups.pop().pop().parentNode);
  }

  expandCollection(currentg, d);

  ticked();
}

function expandCollection(currentg, d){
  if(currentg.attr("expanded") == "false"){
    currentg.attr("expanded", "true");

    expandCollectionTrue(currentg, d);

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

  for (let pAttr of collectionSpecial){
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

  expandShape(currentg, d);
  ticked();
}

function expandShape(currentg, d){
  if(currentg.attr("expanded") == "false"){
    currentg.attr("expanded", "true");

    expandShapeTrue(currentg, d);

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
