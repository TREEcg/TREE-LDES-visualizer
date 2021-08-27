var members;
var membersFailed;
var remainingMembersSetter;
var nodeValidation;
var holder;
var holderId;



export function setValues(_members, _membersFailed, _remainingMembersSetter, _nodeValidation, _holderId){
  members = _members;
  membersFailed = _membersFailed;
  remainingMembersSetter = _remainingMembersSetter;
  nodeValidation = _nodeValidation;
  holderId = _holderId;
}

export function drawMembers(d){
  holder = document.getElementById(holderId);

  if (members[d.name]){
    remainingMembersSetter("Number of members found for selected resource: " + members[d.name].size + ".\n");
  } else {
    remainingMembersSetter("Number of members found for selected resource: 0.\n");
  }

  holder.replaceChildren();
  showMemberHolder(d);

}

function showMemberHolder(d){

  if(!members[d.name] || members[d.name].size == 0) {
    holder.appendChild(document.createTextNode("This node has no members."));
  }

  if (membersFailed && membersFailed[d.name]){
    for (let tempA of membersFailed[d.name]){
      let details = document.createElement("details");
      let summary = document.createElement("summary");
      details.classList.add('failedMember');
      summary.appendChild(document.createTextNode(tempA));
      details.appendChild(summary);
      let textHolder = document.createElement("div");
      textHolder.appendChild(document.createTextNode(members[d.name].get(tempA) + "\n" + nodeValidation[d.name][tempA]));
      textHolder.style["margin-left"] = "1.5rem";
      details.appendChild(textHolder);
      holder.appendChild(details);
    }
  }

  if (members[d.name]){
    for (let tempA of members[d.name].keys()){
      if (!membersFailed[d.name] || !membersFailed[d.name].includes(tempA)){
        let details = document.createElement("details");
        let summary = document.createElement("summary");
        summary.appendChild(document.createTextNode(tempA));
        details.appendChild(summary);
        details.appendChild(document.createTextNode(members[d.name].get(tempA)));
        holder.appendChild(details);
      }
    }
  }
}
