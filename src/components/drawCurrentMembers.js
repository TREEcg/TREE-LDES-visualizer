
// this.svgHolder
// this.svgGHolder
// dF.members
// dF.membersFailed
// this.remainingMembers (setter)
// dF.node_validation



var svgHolder;
var svgGHolder;
var members;
var membersFailed;
var remainingMembersSetter;
var node_validation;

var svgM;
var svgMG;

import * as d3 from "d3";

export function setValues(_svgHolder, _svgGHolder, _members, _membersFailed, _remainingMembersSetter, _node_validation){
  svgHolder = _svgHolder;
  svgGHolder = _svgGHolder;
  members = _members;
  membersFailed = _membersFailed;
  remainingMembersSetter = _remainingMembersSetter;
  node_validation = _node_validation;
}

export function drawMembers(d){
  svgM = svgHolder[1];
  svgMG = svgGHolder[1];

  if (members[d.name]){
    remainingMembersSetter("Number of members found for selected resource: " + members[d.name].size + ".\n");
  } else {
    remainingMembersSetter("Number of members found for selected resource: 0.\n");
  }

  svgGHolder[1].selectAll("g").remove();
  showMemberHolder.call(this, d);
}

function showMemberHolder(d, offsetH = 0){
    let newG = svgMG.append("g").attr("class", "new_g");
    let sortIndex = 0;

    if (membersFailed && membersFailed[d.name]){
      for (let tempA of membersFailed[d.name]){
        let innerG = newG.append("g")
        .attr("sortIndex", sortIndex)
        .attr("expanded", "false")
        .attr("class", "member_g")
        .attr("y", 22+44*sortIndex + offsetH);

        let tt = innerG.append("text").text(tempA)
        .attr("sortIndex", sortIndex)
        .attr("y", 22+44*sortIndex + offsetH);

        tt.style("fill", "#FF0000");

        innerG.on("click", expandMember.bind(this, d, innerG, tempA, newG, false));

        sortIndex++;
      }
    }

    if (members[d.name]){
      for (let tempA of members[d.name].keys()){
        if (!membersFailed[d.name] || !membersFailed[d.name].includes(tempA)){
          let innerG = newG.append("g")
          .attr("sortIndex", sortIndex)
          .attr("expanded", "false")
          .attr("class", "member_g")
          .attr("y", 22+44*sortIndex + offsetH);

          innerG.append("text").text(tempA)
          .attr("sortIndex", sortIndex)
          .attr("y", 22+44*sortIndex + offsetH);

          innerG.on("click", expandMember.bind(this, d, innerG, tempA, newG, true));

          sortIndex++;
        }
      }
    }
    if(!members[d.name] || members[d.name].size == 0) {
      newG.append("g").append("text").text("This node has no members.")
      .attr("dy", 20)
      .attr("dx", 5)
      .attr("x", 0)
      .attr("y", 22 + offsetH);
    }

    let bbox = svgMG.node().getBBox();
    svgM.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
    .attr("width", (bbox.width+bbox.x))
    .attr("height", (bbox.height+bbox.y));
  }



  function expandMember(d, innerG, k, newG, showAll){
    let heightStart = innerG.node().getBBox().height;

    if (innerG.attr("expanded") == "false"){
      innerG.attr("expanded", "true");
      let textArray = [];
      let tempA = members[d.name].get(k)
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

      if (showAll === false && node_validation[k]){
        textArray = node_validation[k].split('\n');

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

    let bbox = svgMG.node().getBBox();
    svgM.attr("viewBox", "0,0,"+(bbox.width+bbox.x)+","+(bbox.height+bbox.y))
    .attr("width", (bbox.width+bbox.x))
    .attr("height", (bbox.height+bbox.y));
  }
