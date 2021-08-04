<!DOCTYPE html>
<meta charset="utf-8">
<style>

text {
  font-size: 12px;
  color: gray;
  pointer-events: none;
}

</style>
<body>
<script src="http://d3js.org/d3.v3.min.js"></script>
<script>

var links = [
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved", rela:"son"},
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved", rela:" " },
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved", rela:" "},
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved", rela:" "},
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved", rela:"father"},
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved",rela:" "},
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved",rela:"son"},
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved",rela:"son" },
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved",rela:"father" },
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved",rela:"son"},
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved",rela:"son" },
{sid:"Zhang Yushan", tid:"Yang Xiao", source: "Zhang Yushan", target: "Yang Xiao", type: "resolved",rela:"Spouse" },
{sid:" ", tid:" ", source: " ", target: " ", type: "resolved",rela:"daughter"},
];

var nodes = {};

links.forEach(function(link) {
  link.source = nodes[link.source] || (nodes[link.source] = {name: link.source, id: link.sid});
  link.target = nodes[link.target] || (nodes[link.target] = {name: link.target, id: link.tid});
});

var width = 1560,
    height = 800;

var force = d3.layout.force()//layout converts the json format to the format available for mechanical drawings
.nodes(d3.values(nodes))//Set node array
.links(links)//Set connection array
.size([width, height])//Scope size
.linkDistance(180)//Length of connecting line
.charge(-1500)//The charge number of the vertex. This parameter determines whether it is repelling or attracting, the smaller the value, the more mutually exclusive
.on("tick", tick)//refers to the time interval, refresh the screen at intervals
.start();//Start conversion

console.log(links);
console.log(nodes);

var svg = d3.select("body")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

//arrow
var marker=
    svg.append("marker")
    //.attr("id", function(d) { return d; })
    .attr("id", "resolved")
//.attr("markerUnits","strokeWidth")//The arrow set to strokeWidth will change with the thickness of the line
    .attr("markerUnits","userSpaceOnUse")
.attr("viewBox", "0 -5 10 10")//The area of ​​the coordinate system
.attr("refX",32)//Arrow coordinates
    .attr("refY", -1)
.attr("markerWidth", 12)//The size of the logo
    .attr("markerHeight", 12)
.attr("orient", "auto")//Drawing direction, can be set to: auto (automatically confirm the direction) and angle value
.attr("stroke-width",2)//arrow width
    .append("path")
.attr("d", "M0,-5L10,0L0,5")//The path of the arrow
.attr('fill','gray');//Arrow color

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

//Set up the connection line
var edges_line = svg.selectAll(".edgepath")
    .data(force.links())
    .enter()
    .append("path")
    .attr({
          'd': function(d) {return 'M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y},
          'class':'edgepath',
          //'fill-opacity':0,
          //'stroke-opacity':0,
          //'fill':'blue',
          //'stroke':'red',
          'id':function(d,i) {return 'edgepath'+i;}})
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
.data(force.nodes()) // means use force.nodes data
    .enter().append("circle")
    .style("fill","white")
    .style('stroke',"gray")
.attr("r", 28)//Set the circle radius
    .on("click",function(node){
        console.log(node.id);
// Make the connection line bold

//when you click
        edges_line.style("stroke-width",function(line){
            if(line.source.name==node.name || line.target.name==node.name){
                return 2;
            }else{
                return 0.5;
            }
        });
        //d3.select(this).style('stroke-width',2);
    })
.call(force.drag);//Pass the currently selected element to the drag function so that the vertex can be dragged
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
var text

= svg.append("g").selectAll("text")
    .data(force.nodes())
//Return a placeholder for missing elements, pointing to a part of the elements in the bound data that is more than the selected element set.
    .enter()
    .append("text")
    .attr("dy", ".35em")
.attr("text-anchor", "middle")//Add data to the circle
    .style('fill',"gray")
    .attr('x',function(d){
        // console.log(d.name+"---"+ d.name.length);
        var re_en = /[a-zA-Z]+/g;
//If it is all English, no line breaks
        if(d.name.match(re_en)){
             d3.select(this).append('tspan')
             .attr('x',0)
             .attr('y',2)
             .text(function(){return d.name;});
        }
//If it is less than four characters, do not wrap
        else if(d.name.length<=4){
             d3.select(this).append('tspan')
            .attr('x',0)
            .attr('y',2)
            .text(function(){return d.name;});
        }else{
            var top=d.name.substring(0,4);
            var bot=d.name.substring(4,d.name.length);

            d3.select(this).text(function(){return '';});

            d3.select(this).append('tspan')
                .attr('x',0)
                .attr('y',-7)
                .text(function(){return top;});

            d3.select(this).append('tspan')
                .attr('x',0)
                .attr('y',10)
                .text(function(){return bot;});
        }
// direct text display
        /*.text(function(d) {
        return d.name; */
    });

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
text.attr("transform", transform2);//Vertex text
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
function transform2(d) {
      return "translate(" + (d.x) + "," + d.y + ")";
}

</script>
