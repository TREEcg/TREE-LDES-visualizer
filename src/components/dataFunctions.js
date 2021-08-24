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

// Exports functions setDataUrl(url), validateAll(url, callBack), addImportLinks(data), getData(url, callBack, fix, extraClear)

//TODO Fix url checks for # identifiers at the end?

var qtext = [];
export var jsondata = null;
export var members = {};
export var membersFailed = [];
export var remarks = "";
export var rootInfo = "";
export var mainInfo = "";
export var data_url = null;
export var shape_validation = null;
export var node_validation = [];
export var shape_report = "";
export var shapeTargets = ['targetClass', 'targetNode', 'targetSubjectsOf', 'targetObjectsOf'];
export var collectionSpecial = ["@type", "import", "importStream", "conditionalImport", "totalItems"];
export var nodeSpecial = ["@type", "import", "importStream", "conditionalImport", "search", "retentionPolicy"];
export var relationSpecial = ["import", "importStream", "conditionalImport"];
export var nodeRemainingItems = Number(0);
var newImportLinks = new Set();
var importedQuads = new Map();
export var myMetadata;
var collectionRef = {"url":undefined, "collectionStore": undefined};
export var collectionStats = {};
const dcterms = 'http://purl.org/dc/terms/';
const hydra = 'http://www.w3.org/ns/hydra/core#';
const rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const shacl = 'http://www.w3.org/ns/shacl#';
const rdfs = 'http://www.w3.org/2000/01/rdf-schema#';
const tree = 'https://w3id.org/tree#';
const ldes = 'https://w3id.org/ldes#';
const st = 'http://www.w3.org/ns/shapetrees#';
// export const collectionAttributes = ['title', 'creator', 'contributor', 'description', 'license'];

export const collectionAttributes = new Map([
  ['title', dcterms+'title'],
  ['creator', dcterms+'creator'],
  ['contributor', dcterms+'contributor'],
  ['description', dcterms+'description'],
  ['license', dcterms+'license'],
  ['total items', hydra+'totalItems']
])


// Use this function to set the url of a new collection
// Setting this and then calling getData with url undefined will then clear all data and start a new collection
export function setDataUrl(url){
  data_url = url;
}

export function addMainInfo(str){
  mainInfo += str;
}


// expected arguments: starting url and callBack function for when all possible nodes have been evaluated
// This function will delete any previous saved data
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

export function clearData(){
  jsondata = {"collection":[], "relations":new Map(), "links":new Map(), "shapes":[], "nodes":[], "views":[]};
  shape_validation = null;
  node_validation = [];
  members = {};
  membersFailed = [];
  shape_report = "";
  newImportLinks = new Set();
  importedQuads = new Map();
  remarks = "";
}


// Used to check if a relation has an import statement defined right before calling getData()
// Used to check if a new node has an import statement defined so it gets imported before creating and validating members
// argument data expects an object and checks for an import and/or conditionalImport property
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
  // const quadsWithSubj = store.getQuads(id, null, null, null);
  const quadsWithSubj = extractShapeHelp(store, id);
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
  shapeIds = shapeIds.concat(store.getQuads(null, tree+'shape', null, null).map(quad => quad.object.id));
  shapeIds = shapeIds.concat(store.getQuads(null, st+'validatedBy', null, null).map(quad => quad.object.id));
  shapeIds = shapeIds.concat(store.getQuads(null, st+'shape', null, null).map(quad => quad.object.id));
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
  const store2 = new N3.Store();
  var quadsWithSubj = extractShapeHelp(store, id);
  // console.log(quadsWithSubj);
  if (id && quadsWithSubj.length == 0){
    let newq = [];

    rdfDereferencer.dereference(id)
    .catch((error) => {
      remarks += "Error while parsing SHAPE data at:\n"+id+".\n\n"+error+"\n";
      alert(error);
      return extractShapeNext(store2, quadsWithSubj, id);
    })
    .then(v => {
    v.quads.on('data', (quad) => {newq.push(quad); /*console.log(quad)*/})
    .on('error', (error) => {console.error(error); let errM = "Error while parsing SHAPE data at:\n"+id+".\n\n"+error+"\n"; remarks += errM; alert(errM);})
    .on('end', () => {
      store2.addQuads(newq);
      return extractShapeNext(store2, quadsWithSubj, id);
    })}).catch(() => {return extractShapeNext(store2, quadsWithSubj, id)});

  } else {
    return extractShapeNext(store2, quadsWithSubj, id);
  }
}


function extractShapeNext(store2, quadsWithSubj, id){
  store2.addQuads(quadsWithSubj);
  var targetQuads = [];
  for (let tempTarget of shapeTargets){
    targetQuads = targetQuads.concat(store2.getQuads(null, shacl+tempTarget, null, null))
  }

  if (targetQuads.length == 0){
    // This check for implicit targeting
    let t1 = store2.getQuads(id, rdf+'type', shacl+'NodeShape', null);
    t1 = t1.concat(store2.getQuads(id, rdf+'type', shacl+'PropertyShape', null));
    let t2 = store2.getQuads(id, rdf+'type', rdfs+'Class', null);

    // If no target was given for the shape, make it target all tree:member objects
    if (t1.length == 0 || t2.length == 0){
      store2.addQuad(
        namedNode(id),
        namedNode(shacl+'targetObjectsOf'),
        namedNode(tree+'member'),
        defaultGraph()
      );

      quadsWithSubj = extractShapeHelp(store2, id);

    }

  }
  return rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
}



function extractShapeMembers(store, ids){
  var quadsWithSubj = [];
  var checked = [];
  for (let id of ids){
    quadsWithSubj = quadsWithSubj.concat(store.getQuads(id, null, null, null));
    // We need quads with a member as object for shacl targetting
    quadsWithSubj = quadsWithSubj.concat(store.getQuads(null, null, id, null));
    quadsWithSubj = quadsWithSubj.concat(extractShapeHelp(store, id, checked));
  }
  return rdfSerializer.serialize(streamifyArray(quadsWithSubj), { contentType: 'text/turtle' });
}


async function derefCollection(collectionUrl, collectionCallBack){
  // This means we do not have to change any data
  if (collectionRef.url && collectionRef.url == collectionUrl){
    if(collectionCallBack){
      collectionCallBack();
    }
    return;
  }

  collectionRef.url = collectionUrl;
  collectionRef.store = new N3.Store();

  // console.log("should get collection data from: ", collectionUrl);

  let newq = [];
  rdfDereferencer.dereference(collectionUrl)
  .catch((error) => {
    let errM = "Error trying to get the collection root.\nWill be unable to provide extra information about the collection.\n" + error+"\n";
    alert(errM)
    remarks += errM;
    fallBackNoType();
    if (collectionCallBack){
      collectionCallBack();
    }
  })
  .then(v => {
    v.quads.on('data', (quad) => {newq.push(quad); /*console.log(quad)*/})
    .on('error', (error) => {console.error(error); let errM = "Error while parsing SHAPE data at:\n"+collectionUrl+".\n\n"+error+"\n"; remarks += errM; alert(errM);})
    .on('end', () => {
      collectionRef.store.addQuads(newq);
      parseCollectionTreeData(newq);
      parseCollection();
      if (collectionCallBack){
        collectionCallBack();
      }
    })
  }).catch(() => {
    fallBackNoType();
    if (collectionCallBack){
      collectionCallBack();
    }
  });

  function fallBackNoType(){
    if (!myMetadata.collections || !myMetadata.collections.size > 0 || !Array.from(myMetadata.collections.values())[0]['@type']){
      mainInfo = "No type property was defined for this collection.\n";
    }
  }
}


//TODO still have to get the shape if no shape was defined on current node?
function parseCollectionTreeData(newq){
  extractMetadata(newq).then(metadata => {

    if (metadata.collections[0] && metadata.collections[0].view){
      for (let viewNode of metadata.collections[0].view){
        let double = false;
        // Check if this view is present on the actual url we followed first
        // We do not have to check if this view is already present in jsondata.views
        // because this function will only get called when we have not yet dereferenced this collection
        // so jsondata.views should at most contain myMetadata.collections[0].view when this gets called
        if (myMetadata.collections[0] && myMetadata.collections[0].view){
          for (let checker of myMetadata.collections[0].view){
            if (checker.name == viewNode['@id']){
              double = true;
            }
          }
        }
        if (!metadata.nodes.has(viewNode['@id'])){
          for (let checker of jsondata.views.concat(jsondata.nodes)){
            if (checker.name == viewNode['@id']){
              double = true;
            }
          }
        }

        let node = {};
        node.id = viewNode['@id']+"_node";
        node.name = viewNode['@id'];
        node.type = "View";

        if (!double && !metadata.nodes.has(viewNode['@id'])){
          jsondata.views.push(node)
          if (jsondata.links.has(collectionRef.url)){
            jsondata.links.get(collectionRef.url).add(viewNode['@id']+"_node");
          } else {
            jsondata.links.set(collectionRef.url, new Set([viewNode['@id']+"_node"]));
          }

        } else if (!double && !myMetadata.nodes.has(viewNode['id'])){
          viewNode = metadata.nodes.get(viewNode['@id']);
          jsondata.nodes = jsondata.nodes.filter(element => element.name != viewNode['@id']);

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

          jsondata.views.push(node)
          if (jsondata.links.has(collectionRef.url)){
            jsondata.links.get(collectionRef.url).add(viewNode['@id']+"_node");
          } else {
            jsondata.links.set(collectionRef.url, new Set([viewNode['@id']+"_node"]));
          }
        }
      }
    }
  })
}

function parseCollection(collectionCallBack){
  if (!myMetadata.collections || !myMetadata.collections.size > 0 || !Array.from(myMetadata.collections.values())[0]['@type']){
    let typeX = Array.from(collectionRef.store.getQuads(collectionRef.url, rdf+'type', null, null).map(quad => quad.object.id))[0];
    if (typeX){
      mainInfo = "Collection type: " + typeX + "\n";
    } else {
      mainInfo = "No type property was defined for this collection.\n";
    }
  }
  collectionStats = {};
  for (let [key, value] of collectionAttributes){
    let attrX = collectionRef.store.getQuads(collectionRef.url, value, null, null).map(quad => quad.object.id);
    if (attrX.length == 1){
      collectionStats[key] = attrX[0];
    } else if (attrX.length > 0){
      collectionStats[key] = JSON.stringify(attrX);
    }
  }
  if(collectionCallBack){
    collectionCallBack();
  }
}


// pass a url to add a new node OR set data_url to go to a new collection
// presence of url variable will get checked BEFORE data_url and thus data_url gets ignored if url is not undefined
// callBack expects a funtion and will call it when all data has been extracted into jsondata, members, ..
// fix expects a function and will be called either when shacl validation is done or when no validation is possible (no shape / no members)
// extraClear expects a function and will be called when clearData() gets called, namely when NO url is passed to this function
// if extraClear gets called this will happen BEFORE any data gets extracted not after
export async function getData(url, callBack, fix, extraClear, collectionCallBack) {
  //Need to always clear these values before getting new data
  qtext = [];
  nodeRemainingItems = 0;


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
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testersecond.ttl';
  // standardURL = 'https://graph.irail.be/sncb/connections/feed';

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

  data_url = standardURL;
  remarks += "\nRemarks for "+data_url+":\n";

  const {quads} = await rdfDereferencer.dereference(standardURL);
  quads.on('data', (quad) => {qtext.push(quad); /*console.log(quad)*/})
  .on('error', (error) => {console.error(error); let errM = "Error while parsing data at:\n"+standardURL+".\n\n"+error+"\n";remarks += errM; alert(errM);})
  .on('end', () => {
    extractMetadata(qtext).then(metadata => {
      console.log("metadata:");
      console.log(metadata);

      myMetadata = metadata;
      var newNodeMembersId;
      const store = new N3.Store(qtext)

      // Having more than one collection is wrong but we can still try drawing a graph
      if (metadata.collections.size > 1){
        let errorText = "";
        errorText += "ERROR: found multiple collections! This is not allowed.\n";
        errorText += JSON.stringify(Array.from(metadata.collections.entries()), null, '/t');
        errorText += "\ncheck tree:view, hydra:view, void:subset, dct:isPartOf, as:partOf.";
        errorText += "\nOther causes: \nmembers/shape are linked not to the collection but the node.";
        errorText += "\ncheck tree:member, hydra:member, as:items, ldp:contains.";
        remarks += errorText + "\n";
        alert(errorText);
      }


      // If no 'new' collection was found, we might already have a collection stored
      if (metadata.collections.size == 0){
        if (jsondata.collection.length == 0){
          let errM = "No collection pre-defined and no collection found on " + standardURL + ".\nPlease provide a different starting URL.\n";
          remarks += errM;
          alert(errM);
          return;
        }

        if (!jsondata[standardURL+"_node"]){
          jsondata[standardURL+"_node"] = [];
          let errM = "no collection metadata found at " + standardURL + ".\nWill add an empty node for this URL.\n";
          remarks += errM;
          alert(errM);
          jsondata.nodes.push({"id":standardURL+"_node", "name":standardURL, "relation_count":0, "type":"Node"})
          if (jsondata.links.has(jsondata.collection[0].id)){
            jsondata.links.get(jsondata.collection[0].id).add(standardURL+"_node");
          } else {
            jsondata.links.set(jsondata.collection[0].id, new Set([standardURL+"_node"]));
          }
        }
      }

      // avoid never calling this callback
      rootInfo = "";
      if (metadata.collections.size == 0){
        fix();
        if(collectionCallBack){
          collectionCallBack();
        }
      } else if (standardURL != Array.from(metadata.collections.keys())[0]){
        // mainInfo = "";
        let collectionUrl = Array.from(metadata.collections.keys())[0];
        derefCollection(collectionUrl, collectionCallBack);
      } else {
        // mainInfo = "";
        rootInfo = "Your IRI points towards the root of this collection.\n";
        collectionRef.url = standardURL;
        collectionRef.store = new N3.Store(qtext);
        parseCollection(collectionCallBack);
      }

      // The main data parsing part
      for (var collectionId of metadata.collections.keys()) {
        var collectionObj = metadata.collections.get(collectionId);

        if (collectionObj['@type']){
          mainInfo = "Collection type: " + collectionObj['@type'][0] + "\n";
          if (collectionObj['@type'][0] == ldes+"EventStream"){
            mainInfo += "This is an LDES event stream, all members are immutable";
          }
        }
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
          remarks += errorText+"\n";
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


        // Create view 'nodes' found at the current url
        if (collectionObj.view){
          for (let viewNode of collectionObj.view){
            let double = false;
            if (!metadata.nodes.has(viewNode['@id'])){
              for (let checker of jsondata.views.concat(jsondata.nodes)){
                if (checker.name == viewNode['@id']){
                  double = true;
                }
              }
            }

            let node = {};
            node.id = viewNode['@id']+"_node";
            node.name = viewNode['@id'];
            node.type = "View";

            if (!double && !metadata.nodes.has(viewNode['@id'])){
              if(standardURL == node.name){
                node.relation_count = 0;
              }
              jsondata.views.push(node)
              if (jsondata.links.has(collectionId)){
                jsondata.links.get(collectionId).add(viewNode['@id']+"_node");
              } else {
                jsondata.links.set(collectionId, new Set([viewNode['@id']+"_node"]));
              }

            } else if (!double){
              viewNode = metadata.nodes.get(viewNode['@id']);
              jsondata.nodes = jsondata.nodes.filter(element => element.name != viewNode['@id']);

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

              jsondata.views.push(node)
              if (jsondata.links.has(collectionId)){
                jsondata.links.get(collectionId).add(viewNode['@id']+"_node");
              } else {
                jsondata.links.set(collectionId, new Set([viewNode['@id']+"_node"]));
              }
            }
          }
        }

        //NOTICE a node can be in both .subset and .view!
        let iter = [];
        if (collectionObj.subset){
          iter = iter.concat(collectionObj.subset);
        }
        if (metadata.nodes){
          iter = iter.concat(Array.from(metadata.nodes.values()));
        }

        if (collectionObj.subset || metadata.nodes){
        // if (metadata.nodes.values() && metadata.nodes.values()){
          for (let viewNode of iter){
            if (metadata.nodes.has(viewNode['@id'])){
              viewNode = metadata.nodes.get(viewNode['@id']);
            }
            let double = false;
            for (let checker of jsondata.nodes){
              if (checker.name == viewNode['@id']){
                double = true;
              }
            }

            if (!double){
              let node = {};
              node.id = viewNode['@id']+"_node";
              node.name = viewNode['@id'];

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



              let found = false;
              jsondata.views = jsondata.views.filter(v => {
                if (v.name == node.name){
                  found = true;
                }
                return v.name != node.name;
              })

              if (found){
                node.type = "View";
                jsondata.views.push(node);
              } else {
                node.type = "Node";
                jsondata.nodes.push(node);
              }

              if (jsondata.links.has(collectionId)){
                jsondata.links.get(collectionId).add(viewNode['@id']+"_node");
              } else {
                jsondata.links.set(collectionId, new Set([viewNode['@id']+"_node"]));
              }

            }
          }
        }

        //TODO This is not a good way of linking the members to the correct node
        //What if multiple nodes are defined? What if a view & subset is defined?
        if(metadata.nodes && metadata.nodes.size > 0){
          newNodeMembersId = [];
          if (metadata.nodes.size > 0){
            newNodeMembersId = Array.from(metadata.nodes.keys());
          } else {
            newNodeMembersId = [standardURL];
          }
          // const newNodeMembersId = jsondata.nodes[jsondata.nodes.length -1].name;
          for (let mId of newNodeMembersId){
            members[mId] = new Map();
          }



          importedQuads.forEach((v,k) => {
            if (newImportLinks.has(k)){
              store.addQuads(v);
            }
            newImportLinks.delete(k);
          });

          const importPromises = [...newImportLinks].map(url => new Promise((resolve, reject) => {
            let newQuads = [];
            rdfDereferencer.dereference(url)
            .catch((e) => {
              console.error(e);
              resolve();
            })
            .then(v => {v.quads.on('data', (quad) => {newQuads.push(quad)})
              .on('error', (error) => {console.error(error); let errM = "Error while parsing import data at:\n"+url+"\n\n" +error+"\n"; remarks+= errM;alert(errM); reject()})
              .on('end', () => {
                importedQuads.set(url, newQuads);
                store.addQuads(newQuads);
                resolve();
              })
            }).catch((e) => {
              console.error(e);
              resolve();
            })
          }))

          Promise.all(importPromises).then(() => {
            if (collectionObj.member){
              let membIds = [];

              const memberPromises = collectionObj.member.map(m =>
                new Promise((resolve) => {
                  membIds.push(m['@id']);
                  extractId(store, m['@id']).then(mtemp => {
                    for (let mId of newNodeMembersId){
                      members[mId].set(m['@id'], mtemp);
                    }
                    resolve();
                  })
                })
              );

              Promise.all(memberPromises)
              .catch((e) => {
                console.error(e);
                fix()
              })
              .then(() => {
                if (jsondata.shapes.size > 0 || collectionObj.shape){
                  validateShape(membIds, store, newNodeMembersId, fix);
                } else {
                  fix();
                }
              }).catch(() => fix());

            } else {
              remarks += "Found no members at " + standardURL + ".\n";
              fix();
            }
          });
        } else {
          fix();
        }

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
        jsondata[nodeId].remainingItems = 0;
        for (var relationJson of jsondata[nodeId]){
          if (metadata.relations.get(relationJson.id)){

            var relationObj = metadata.relations.get(relationJson.id);
            if (!relationObj.node || !relationObj.node[0]['@id']){
              let errM = "Error: relation from " + nodeId + " has no node defined!\nThis is not allowed!\nRelation: " + JSON.stringify(relationObj, null, '\t') + "\n\n";
              remarks += errM;
              alert(errM);
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

            if (relationObj["remainingItems"]){
              jsondata[nodeId].remainingItems += Number(relationObj["remainingItems"][0]["@value"]);
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

      // if (remarks != ""){
      //   alert(remarks);
      //   console.log(remarks);
      // }

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
          if (callBack){
            callBack();
          }
        });

      } else {
        newImportLinks = new Set();
        if (callBack){
          callBack();
        }
      }

    })

  });

}



async function validateShape(membIds, store, newNodeMembersId, fix){
  // console.log("validating");
  for (let mId of newNodeMembersId){
    membersFailed[mId] = [];
    node_validation[mId] = {};
  }

  const shapeIds = getShapeIds(store);

  if (shapeIds.size > 1){
    let errM = "Found multiple shapes, will only validate using the first one.\n" + JSON.stringify(shapeIds);
    alert(errM);
    remarks += errM;
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

      // This makes it so the BlankNode identifiers here are the same as those shown in the shape
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

      shape_report += "\nResult report for "+data_url+":\n";

      for (const result of report.results) {
        // See https://www.w3.org/TR/shacl/#results-validation-result for details about each property
        let mX = "";

        mX += "\nmessage: \n";
        for (let mt of result.message){
          mX += "\t" + mt['value']+"\n";
        }
        mX += "path: " + result.path['value'] + "\n";
        mX += "focusNode: " + result.focusNode['value'] + "\n";
        for (let mId of newNodeMembersId){
          membersFailed[mId].push(result.focusNode['value']);
        }
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
      if (fix){
        fix();
      }
    }).catch((e) => {
      console.error("Error with members while validating\n"+e);
      if (fix){
        fix();
      }
    });
  }).catch((e) => {
    console.error("Error with shape while validating\n"+e);
    if (fix){
      fix();
    }
  });

}
