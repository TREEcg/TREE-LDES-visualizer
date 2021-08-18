import rdfDereferencer from "rdf-dereference";
import 'setimmediate';

const extractMetadata = require('@treecg/tree-metadata-extraction').extractMetadata
import * as N3 from 'n3';
import rdfSerializer from "rdf-serialize";
const streamifyArray = require('streamify-array');
const stringifyStream = require('stream-to-string');

const factory = require('rdf-ext');
const ParserN3 = require('@rdfjs/parser-n3');
const SHACLValidator = require('rdf-validate-shacl');

const { DataFactory } = N3;
const { namedNode, defaultGraph } = DataFactory;


export var qtext = [];
export var jsondata = null;
export var members = {};
export var membersFailed = [];
export var remarks = "";
export var data_url = null;
export function setDataUrl(url){
  data_url = url;
}
export var shape_validation = null;
export var node_validation = [];
export var shape_report = "";
export var shapeTargets = ['targetClass', 'targetNode', 'targetSubjectsOf', 'targetObjectsOf'];
export var collectionSpecial = ["@type", "import", "importStream", "conditionalImport", "totalItems"];
export var nodeSpecial = ["@type", "import", "importStream", "conditionalImport", "search", "retentionPolicy"];
export var relationSpecial = ["import", "importStream", "conditionalImport"];
export var newImportLinks = new Set();
export var importedQuads = new Map();
var myMetadata;

export function validateAll(url, callBack){
  if (!url){
    alert("Please enter a starting url.");
    return;
  }
  clearData();
  const todo = [{"url":url, "imports":[]}];
  const done = new Set();
  validateNext(todo, done, callBack);
}

//TODO should probably not throw alerts while processing? But instead use an updating report?
function validateNext(todo, done, callBack){
  console.log("still to be validated: ", JSON.parse(JSON.stringify(todo)));
  if (todo.length > 0){
    let next;
    do {
      next = todo.shift()
    } while (todo.size > 0 && done.has(next.url));


    if (!done.has(next.url)){
      var promiseResolve1
      var p1 = new Promise(function(resolve){
        promiseResolve1 = resolve;
      });

      var promiseResolve2
      var p2 = new Promise(function(resolve){
        promiseResolve2 = resolve;
      });

      Promise.all([p1, p2]).then(() => {
        myMetadata.relations.forEach(v => {
          todo.push({"url":v.node[0]['@id'], "imports":getImportLinks(v)})
        })
        if (todo.length > 0){
          validateNext(todo, done, callBack);
        } else {
          callBack();
        }
      });

      next.imports.forEach(v => newImportLinks.add(v));
      getData(next.url, promiseResolve1, promiseResolve2);
      done.add(next.url);
    } else {
      callBack();
    }
  }

}

function clearData(){
  jsondata = {"collection":[], "relations":new Map(), "links":new Map(), "shapes":[], "nodes":[]};
  shape_validation = null;
  node_validation = [];
  members = {};
  membersFailed = [];
  shape_report = "";
  newImportLinks = new Set();
  importedQuads = new Map();
}

export function addImportLinks(data){
  getImportLinks(data).forEach(v => newImportLinks.add(v));
}

function getImportLinks(data){
  let found = new Set();
  if (data.import){
    for (let importX of data.import){
      found.add(importX['@id']);
    }
  }

  if (data.conditionalImport){
    for (let importX of data.conditionalImport.import){
      found.add(importX['@id']);
    }
  }
  return found;
}

async function extractId(store, id) {
  const quadsWithSubj = store.getQuads(id, null, null, null);
  const textStream = rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
  return await stringifyStream(textStream);
}

async function extractShapeId(store, id){
  const quadsWithSubj = extractShapeHelp(store, id);
  const textStream = rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
  return await stringifyStream(textStream);
}

function getShapeIds(store){
  var shapeIds = [];
  shapeIds = shapeIds.concat(store.getQuads(null, 'https://w3id.org/tree#shape', null, null).map(quad => quad.object.id));
  shapeIds = shapeIds.concat(store.getQuads(null, 'http://www.w3.org/ns/shapetrees#validatedBy', null, null).map(quad => quad.object.id));
  shapeIds = shapeIds.concat(store.getQuads(null, 'http://www.w3.org/ns/shapetrees#shape', null, null).map(quad => quad.object.id));
  return shapeIds;
}

function extractShapeHelp(store, id, checked = []) {
  var quadsWithSubj = store.getQuads(id, null, null, null);
  for (let quad of quadsWithSubj){
    if (quad.object.termType === "NamedNode" || quad.object.termType === "BlankNode") {
      if (quad.object.id && !checked.includes(quad.object.id)){
        checked.push(quad.object.id);
        quadsWithSubj = quadsWithSubj.concat(extractShapeHelp(store, quad.object.id, checked));
      }
    }
  }
  return quadsWithSubj;
}

async function extractShape(store, id){
  var quadsWithSubj = extractShapeHelp(store, id);

  const store2 = new N3.Store();
  store2.addQuads(quadsWithSubj);
  var targetQuads = [];
  for (let tempTarget of shapeTargets){
    targetQuads = targetQuads.concat(store2.getQuads(null, 'http://www.w3.org/ns/shacl#'+tempTarget, null, null))
  }

  if (targetQuads.length == 0){
    // This check for implicit targeting
    let t1 = store2.getQuads(id, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type','http://www.w3.org/ns/shacl#NodeShape', null);
    t1 = t1.concat(store2.getQuads(id, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/ns/shacl#PropertyShape', null));
    let t2 = store2.getQuads(id, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', 'http://www.w3.org/2000/01/rdf-schema#Class', null);

    // If no target was given for the shape, make it target all tree:member objects
    if (t1.length == 0 || t2.length == 0){
      store2.addQuad(
        namedNode(id),
        namedNode('http://www.w3.org/ns/shacl#targetObjectsOf'),
        namedNode('https://w3id.org/tree#member'),
        defaultGraph()
      );

      quadsWithSubj = extractShapeHelp(store2, id);
    }

  }

  return rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
}

function extractShapeMembers(store, ids){
  var quadsWithSubj = [];
  for (let id of ids){
    quadsWithSubj = quadsWithSubj.concat(store.getQuads(id, null, null, null));
    // We need quads with a member as object for shacl targetting
    quadsWithSubj = quadsWithSubj.concat(store.getQuads(null, null, id, null));
  }
  return rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
}

// export const getData = new Promise((resolve) =>
export async function getData(url, callBack, fix, extraClear) {
  //Need to always clear these values before getting new data
  qtext = [];
  remarks = "";

  //var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/a.nt';
  var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/.root.nt'
  standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/stops_a4.nt';
  standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/cht_1_2.ttl';
  // standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/marine1.jsonld';
  // standardURL = 'https://bag2.basisregistraties.overheid.nl/feed/2020-08-14T16:05';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testerfirst.ttl';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testerMultipleImports.ttl';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testerfirst.ttl';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/implicitShapeTest.ttl';

  if(url){
    standardURL = url;
  } else if (data_url){
    standardURL = data_url;
    // This means user gave a url for a new collection so we need to clear whatever data we already had
    clearData();
    if (extraClear){
      extraClear();
    }
  } else {
    //Fallback
    clearData();
    if (extraClear){
      extraClear();
    }
  }

  const {quads} = await rdfDereferencer.dereference(standardURL);
  quads.on('data', (quad) => {qtext.push(quad); /*console.log(quad)*/})
  .on('error', (error) => {console.error(error); alert("Error while parsing data at:\n"+standardURL+".\n\n"+error)})
  .on('end', () => {
    extractMetadata(qtext).then(metadata => {
      myMetadata = metadata;
      console.log("metadata:");
      console.log(metadata);

      const store = new N3.Store(qtext)

      // Having more than one collection is wrong but we can still try drawing a graph
      if (metadata.collections.size > 1){
        let errorText = "";
        errorText += "ERROR: found multiple collections! This is not allowed.\n";
        errorText += JSON.stringify(metadata.collections, null, '/t');
        errorText += "\ncheck tree:view, hydra:view, void:subset, dct:isPartOf, as:partOf.";
        errorText += "\nOther causes: \nmembers/shape are linked not to the collection but the node.";
        errorText += "\ncheck tree:member, hydra:member, as:items, ldp:contains.";
        alert(errorText);
      }


      // If no 'new' collection was found, we might already have a collection stored
      if (metadata.collections.size == 0){
        if (jsondata.collection.length == 0){
          alert("No collection pre-defined and no collection found on " + standardURL + ".\nPlease provide a different starting URL.");
          return;
        }

        if (!jsondata[standardURL+"_node"]){
          jsondata[standardURL+"_node"] = [];
          alert("no collection metadata found at " + standardURL + ".\nWill add an empty node for this URL.");
          jsondata.nodes.push({"id":standardURL+"_node", "name":standardURL, "relation_count":0})
          if (jsondata.links.has(jsondata.collection[0].id)){
            jsondata.links.get(jsondata.collection[0].id).add(standardURL+"_node");
          } else {
            jsondata.links.set(jsondata.collection[0].id, new Set([standardURL+"_node"]));
          }
        }
      }

      // avoid never calling this callback
      if (metadata.collections.size == 0){
        fix();
      }

      // The main data parsing part
      for (var collectionId of metadata.collections.keys()) {
        var collectionObj = metadata.collections.get(collectionId);


        // If we already had a collection stored, check to make sure the 'new' one is the same as the old one
        let double = true;
        if (jsondata.collection.length > 0){
          for (let checker of jsondata.collection){
            if (checker.id != collectionId){
              double = false;
            }
          }
        }


        // If the new collection is not the same throw an error
        if (!double){
          let errorText = "";
          errorText += "ERROR: new node is linked to a different collection! This is not allowed.";
          errorText += '\n' + "current URL: " + standardURL;
          errorText += '\n' + "new collection: " + collectionId;
          errorText += '\n' + "original collection: " + jsondata.collection[0].id;
          alert(errorText);
          return;
        }


        // If we did not have a collection stored already add it to jsondata.collection
        if (jsondata.collection.length == 0){
          let collection = {};
          collection.id = collectionId;
          collection.type = "Collection";
          collection.vocab = collectionObj['@context']["@vocab"];

          for (let pAttr of collectionSpecial){
            if (collectionObj[pAttr]){
              collection[pAttr] = collectionObj[pAttr];
            }
          }

          jsondata.collection.push(collection);
        }


        // Check for new nodes, either defined via collection->view or directly via nodes
        if (collectionObj.view || metadata.nodes.size > 0){
          let iter = (metadata.nodes.size > 0) ? metadata.nodes.values() : collectionObj.view;
          for (var viewNode of iter){

            // Change the id by appending _node because collection and view can have the same URI
            // We do still want to show them as two separate nodes even though they have the same URL

            let double = false;
            for (let checker of jsondata.nodes){
              if (checker.id == viewNode['@id']+"_node"){
                double = true;
              }
            }

            if (!double){
              let node = {};
              node.id = viewNode['@id']+"_node";
              node.name = viewNode['@id'];
              // the metadata extractor will only find a node if it has at least one property, else it will only show up as a view
              if(metadata.nodes && metadata.nodes.get(viewNode['@id']) && metadata.nodes.get(viewNode['@id']).relation){
                node.relation_count = metadata.nodes.get(viewNode['@id']).relation.length;
              } else {
                node.relation_count = 0;
              }


              for (let pAttr of nodeSpecial){
                if (viewNode[pAttr]){
                  node[pAttr] = viewNode[pAttr];
                }
              }

              addImportLinks(node);

              jsondata.nodes.push(node)
              if (jsondata.links.has(collectionId)){
                jsondata.links.get(collectionId).add(viewNode['@id']+"_node");
              } else {
                jsondata.links.set(collectionId, new Set([viewNode['@id']+"_node"]));
              }
            }
          }
        } else {
          alert("Did not find any nodes linked to this url\n" + standardURL);
        }

        //TODO This is not a good way of linking the members to the correct node
        //What if multiple nodes are defined? What if a view & subset is defined?
        const newNodeMembersId = jsondata.nodes[jsondata.nodes.length -1].name;
        members[newNodeMembersId] = new Map();


        importedQuads.forEach((v,k) => {
          if (newImportLinks.has(k)){
            store.addQuads(v);
          }
          newImportLinks.delete(k);
        });

        const importPromises = [...newImportLinks].map(url => {new Promise((resolve, reject) => {
          let newQuads = [];
          rdfDereferencer.dereference(url).then(v => {v.quads.on('data', (quad) => {newQuads.push(quad)})
          .on('error', (error) => {console.error(error); alert("Error while parsing import data at:\n"+url+"\n\n" +error); reject})
          .on('end', () => {
            importedQuads.set(url, newQuads);
            store.addQuads(newQuads);
            resolve;
          })
        })})})


        Promise.all(importPromises).then(() => {
          if (collectionObj.member){
            let membIds = [];
            for (var memb of collectionObj.member){
              membIds.push(memb['@id']);
              // Need to save id inside loop because used in async push
              let tX = memb['@id'];
              extractId(store, memb['@id']).then(mtemp => {
                members[newNodeMembersId].set(tX, mtemp);
              });
            }
            if (jsondata.shapes.size > 0 || collectionObj.shape){
              validateShape(membIds, store, newNodeMembersId, fix);
            } else {
              fix();
            }
          } else {
            remarks += "Found no members for " + newNodeMembersId + ".\n";
          }
        });

      }

      // This does not need a duplicate check since old node relations won't be included in the new metadata
      // or they will just overwrite with the exact same data as was already present
      for (var nodeId of metadata.nodes.keys()){
        jsondata.links.delete(nodeId+"_node");
        var nodeObj = metadata.nodes.get(nodeId);
        jsondata[nodeId+"_node"] = [];
        for (var relation of nodeObj.relation){
          jsondata[nodeId+"_node"].push({"id":relation['@id'], "name":relation['@id']});
        }
      }

      let tempN = [];
      // If metadata.nodes had no new node, a new empty node still got added to the graph
      // Need to ensure a link for all relations leading to this node is also created via standardURL_node
      let it = metadata.nodes.keys();
      if (metadata.nodes.size == 0){
        it = [standardURL];

        jsondata.links.delete(standardURL+"_node");
        jsondata[standardURL+"_node"] = [];
      }
      for (let nodeName of it){
        let nodeId = nodeName + "_node"
        //This will hold all newly added nodes to later check if they conform to any already existing relations
        tempN.push(nodeId);
        for (var relationJson of jsondata[nodeId]){
          if (metadata.relations.get(relationJson.id)){

            var relationObj = metadata.relations.get(relationJson.id);
            if (!relationObj.node || !relationObj.node[0]['@id']){
              alert("Error: relation from " + nodeId + " has no node defined!\nThis is not allowed!\nRelation: " + JSON.stringify(relationObj, null, '\t'));
              break;
            }
            relationJson.node = relationObj.node;

            if (jsondata.relations.has(nodeId)){
              jsondata.relations.get(nodeId).add(relationObj.node[0]['@id']+"_node");
            } else {
              jsondata.relations.set(nodeId, new Set([relationObj.node[0]['@id']+"_node"]));
            }

            if(!relationObj['@type']){
              remarks += "relation from " + nodeName + " to " + relationObj.node[0]['@id'] + " has no type defined\n";
            } else {
              relationJson.type = relationObj['@type'];
            }

            let wantedAttrs = ["path", "value", "remainingItems"];
            for (let wAttr of wantedAttrs){
              if (relationObj[wAttr]){
                relationJson[wAttr] = relationObj[wAttr];
              } else if (wAttr != "remainingItems"){
                remarks += "relation from " + nodeName + " to " + relationObj.node[0]['@id'] + " has no " + wAttr + " defined\n";
              }
            }

            for (let pAttr of relationSpecial){
              if (relationObj[pAttr]){
                relationJson[pAttr] = relationObj[pAttr];
              }
            }

            //This checks if the node this relation links to already exists in the graph
            if(jsondata[relationObj.node[0]['@id']+"_node"]){
              if (jsondata.links.has(nodeId)){
                jsondata.links.get(nodeId).add(relationObj.node[0]['@id']+"_node");
              } else {
                jsondata.links.set(nodeId, new Set([relationObj.node[0]['@id']+"_node"]));
              }
            }

          }
        }

        //This checks if any of the newly added nodes are the target of a relation already on the graph
        for (let [tempKey, tempSet] of jsondata.relations){
          for (let tempValue of tempSet){
            if (tempN.includes(tempValue)){
              if (jsondata.links.has(tempKey)){
                jsondata.links.get(tempKey).add(tempValue);
              } else {
                jsondata.links.set(tempKey, new Set([tempValue]));
              }
            }
          }
        }

      }

      if (remarks != ""){
        alert(remarks);
        console.log(remarks);
      }

      console.log("jsondata:");
      console.log(jsondata);

      console.log("members:");
      console.log(members);


      // TODO shape is defined on the collection so shape is never allowed to change
      if (jsondata.shapes.length == 0 && metadata.collections.get(collectionId).shape){
        const shapeIds = getShapeIds(store);

        extractShapeId(store, shapeIds[0]).then(res => {
          jsondata.shapes.push({"id":shapeIds[0], "type":"shape", "shape_extra":res});
          if (jsondata.links.has(collectionId)){
            jsondata.links.get(collectionId).add(shapeIds[0]);
          } else {
            jsondata.links.set(collectionId, new Set([shapeIds[0]]));
          }
          newImportLinks = new Set();
          // drawing();
          // resolve();
          if (callBack){
            callBack();
          }
        });

      } else {
        newImportLinks = new Set();
        // drawing();
        // resolve();
        if (callBack){
          callBack();
        }
      }

    })

  });

}
// );

function validateShape(membIds, store, newNodeMembersId, fix){
  membersFailed[newNodeMembersId] = [];
  node_validation[newNodeMembersId] = {};
  const shapeIds = getShapeIds(store);

  if (shapeIds.size > 1){
    alert("Found multiple shapes, will only validate using the first one.\n" + JSON.stringify(shapeIds));
  }
  if (shapeIds.size == 0){
    remarks += "URL did not include a shacl shape given via tree:shape or st:validatedBy.\n"
  }

  async function loadDatasetX (stream) {
    const parser = new ParserN3({ factory });
    return factory.dataset().import(parser.import(await stream));
  }

  const shapesX = extractShape(store, shapeIds[0]);
  const dataX = extractShapeMembers(store, membIds);

  loadDatasetX(shapesX).then(shapes => {
    loadDatasetX(dataX).then(data => {

      let dtX = [];
      for (let sX of shapes){
        if (sX.object.termType == "BlankNode" && !dtX.includes(sX.object.value)){
          sX.object.value = sX.object.value.slice(3);
          dtX.push(sX.object.value)
        }
        if (sX.subject.termType == "BlankNode" && !dtX.includes(sX.subject.value)){
          sX.subject.value = sX.subject.value.slice(3);
          dtX.push(sX.subject.value)
        }
      }

      const validator = new SHACLValidator(shapes, { factory });
      const report = validator.validate(data);

      if (shape_validation && shape_validation === false){
        shape_validation = false;
      } else {
        shape_validation = report.conforms;
      }

      shape_report += "\nResult report for "+newNodeMembersId+":\n";

      for (const result of report.results) {
        // See https://www.w3.org/TR/shacl/#results-validation-result for details about each property
        let mX = "";

        mX += "\nmessage: \n";
        for (let mt of result.message){
          mX += "\t" + mt['value']+"\n";
        }
        mX += "path: " + result.path['value'] + "\n";
        mX += "focusNode: " + result.focusNode['value'] + "\n";
        membersFailed[newNodeMembersId].push(result.focusNode['value']);
        mX += "severity: " + result.severity['value'] + "\n";
        mX += "sourceConstraintComponent: " + result.sourceConstraintComponent['value'] + "\n";
        mX += "sourceShape: " + result.sourceShape['value'] + "\n";

        shape_report += mX;

        if (result.focusNode && result.focusNode['value']){
          node_validation[result.focusNode['value']] = mX;
        }
      }

      if (report.results.length == 0){
        shape_report += "All checks passed.";
      }

    });
  });
  if (fix){
    fix();
  }
}
