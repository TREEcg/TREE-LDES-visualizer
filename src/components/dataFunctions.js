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
export var collectionStats = {};
export var relationLabelMap = new Map();
export var redirectMappings = new Map();


var urlMappings = new Map();
var qtext = [];
var newImportLinks = new Set();
var importedQuads = new Map();
var collectionRef = {"url":undefined, "collectionStore": undefined};
var myMetadata;
var loaded = new Set();


export const shapeTargets = ['targetClass', 'targetNode', 'targetSubjectsOf', 'targetObjectsOf'];
export const collectionSpecial = ["@type", "import", "importStream", "conditionalImport", "totalItems"];
export const nodeSpecial = ["@type", "import", "importStream", "conditionalImport", "search", "retentionPolicy"];
export const relationSpecial = ["import", "importStream", "conditionalImport"];


const dcterms = 'http://purl.org/dc/terms/';
const hydra = 'http://www.w3.org/ns/hydra/core#';
const rdf = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const shacl = 'http://www.w3.org/ns/shacl#';
const rdfs = 'http://www.w3.org/2000/01/rdf-schema#';
const tree = 'https://w3id.org/tree#';
const ldes = 'https://w3id.org/ldes#';
const st = 'http://www.w3.org/ns/shapetrees#';


export const collectionAttributes = new Map([
  ['Title', dcterms+'title'],
  ['Creator', dcterms+'creator'],
  ['Contributor', dcterms+'contributor'],
  ['Description', dcterms+'description'],
  ['License', dcterms+'license'],
  ['Total items', hydra+'totalItems']
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
  relationLabelMap = new Map();
  urlMappings = new Map();
  redirectMappings = new Map();
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
      // alert(error);
      return extractShapeNext(store2, quadsWithSubj, id);
    })
    .then(v => {
    v.quads.on('data', (quad) => {newq.push(quad); /*console.log(quad)*/})
    .on('error', (error) => {console.error(error); let errM = "Error while parsing SHAPE data at:\n"+id+".\n\n"+error+"\n"; remarks += errM; /*alert(errM);*/})
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
    // alert(errM)
    remarks += errM;
    fallBackNoType();
    if (collectionCallBack){
      collectionCallBack();
    }
  })
  .then(v => {
    v.quads.on('data', (quad) => {newq.push(quad); /*console.log(quad)*/})
    .on('error', (error) => {console.error(error); let errM = "Error while parsing SHAPE data at:\n"+collectionUrl+".\n\n"+error+"\n"; remarks += errM; /*alert(errM);*/})
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
      // mainInfo = "No type property was defined for this collection.\n";
      mainInfo = "";
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
          mapAddToSet(jsondata.links, collectionRef.url, viewNode['@id']+"_node");

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
          mapAddToSet(jsondata.links, collectionRef.url, viewNode['@id']+"_node");
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
      // mainInfo = "No type property was defined for this collection.\n";
      mainInfo = "";
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


function mapAddToSet(myMap, myKey, myValue){
  if (myMap.has(myKey)){
    myMap.get(myKey).add(myValue);
  } else {
    myMap.set(myKey, new Set([myValue]));
  }
}


function dummyFunction(){
  return;
}


// pass a url to add a new node OR set data_url to go to a new collection
// presence of url variable will get checked BEFORE data_url and thus data_url gets ignored if url is not undefined
// All callback functions will be called even when function quits with errors
// callBack expects a funtion and will call it when all data has been extracted into jsondata, members, ..
// fix expects a function and will be called either when shacl validation is done or when no validation is possible (no shape / no members)
// extraClear expects a function and will be called when clearData() gets called, namely when NO url is passed to this function
// if extraClear gets called this will happen BEFORE any data gets extracted not after
// CollectionCallBack will be called when the actual collection root has been dereferenced
export async function getData(urlX, callBack = dummyFunction, fix = dummyFunction, extraClear = dummyFunction, collectionCallBack = dummyFunction) {
  //Need to always clear these values before getting new data
  qtext = [];



  //var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/a.nt';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/.root.nt'
  // standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/stops_a4.nt';
  // standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/cht_1_2.ttl';
  // standardURL = 'https://raw.githubusercontent.com/Mikxox/visualizer/main/src/assets/marine1.jsonld';
  // standardURL = 'https://bag2.basisregistraties.overheid.nl/feed/2020-08-14T16:05';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testerfirst.ttl';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testerMultipleImports.ttl';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testerfirst.ttl';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/implicitShapeTest.ttl';
  // standardURL = 'https://raw.githubusercontent.com/TREEcg/TREE-LDES-visualizer/main/src/assets/testersecond.ttl';
  // standardURL = 'https://graph.irail.be/sncb/connections/feed';

  if(urlX){
    data_url = urlX;
  } else if (data_url){
    // This means user gave a url for a new collection so we need to clear whatever data we already had
    clearData();
    extraClear();
  } else {
    //Fallback
    alert("No starting point defined.")
    clearData();
    callBack();
    fix();
    extraClear();
    collectionCallBack();
  }

  if (loaded.has(data_url)){
    return;
  }
  if (redirectMappings.has(data_url)){
    for (let tX of redirectMappings.get(data_url)){
      if (loaded.has(tX)){
        return;
      }
    }
  }

  remarks += "\nRemarks for "+data_url+":\n";

  const {quads, url} = await rdfDereferencer.dereference(data_url);
  urlMappings.set(url, data_url);
  quads.on('data', (quad) => {qtext.push(quad); /*console.log(quad)*/})
  .on('error', (error) => {console.error(error); let errM = "Error while parsing data at:\n"+data_url+".\n\n"+error+"\n";remarks += errM; /*alert(errM);*/})
  .on('end', () => {
    extractMetadata(qtext).then(metadata => {
      console.log("metadata:");
      console.log(metadata);

      if (data_url != url){
        mapAddToSet(redirectMappings, data_url, url);
      }

      if (metadata.nodes && metadata.nodes.size > 0){
        mapAddToSet(redirectMappings, data_url, Array.from(metadata.nodes.keys())[0]);
      }

      myMetadata = metadata;
      const store = new N3.Store(qtext)

      // Having more than one collection is not supported but we can still try drawing a graph
      if (metadata.collections.size > 1){
        let errorText = "";
        errorText += "Warning: found multiple collections. This is not supported.\n";
        errorText += JSON.stringify(Array.from(metadata.collections.entries()), null, '/t');
        errorText += "\ncheck tree:view, hydra:view, void:subset, dct:isPartOf, as:partOf.";
        errorText += "\nOther causes: \nmembers/shape are linked not to the collection but the node.";
        errorText += "\ncheck tree:member, hydra:member, as:items, ldp:contains.";
        errorText += "Will try creating a graph using only the first collection.\n"
        remarks += errorText + "\n";
        alert(errorText);
      }


      // If no 'new' collection was found, we might already have a collection stored
      if (metadata.collections.size == 0){
        if (jsondata.collection.length == 0){
          let errM = "No collection pre-defined and no collection found at " + data_url + ".\nPlease provide a different starting URL.\n";
          remarks += errM;
          alert(errM);
          return;
        }

        if (!jsondata[data_url+"_node"] && !jsondata[url+"_node"]){
          jsondata[data_url+"_node"] = [];
          let errM = "no collection metadata found at " + data_url + ".\nWill add an empty node for this URL.\n";
          remarks += errM;
          jsondata.nodes.push({"id":data_url+"_node", "name":data_url, "relation_count":0, "type":"Node"})
        }
      }


      rootInfo = "";
      if (metadata.collections.size == 0){
        // avoid never calling these, callback() will be called after trying to check shape aswell
        fix();
        extraClear();
        collectionCallBack();
      } else if (data_url != Array.from(metadata.collections.keys())[0]){
        let collectionUrl = Array.from(metadata.collections.keys())[0];
        derefCollection(collectionUrl, collectionCallBack);
      } else {
        rootInfo = "Your IRI points towards the root of this collection.\n";
        collectionRef.url = data_url;
        collectionRef.store = new N3.Store(qtext);
        parseCollection(collectionCallBack);
      }

      // The main data parsing part, for loop to avoid throwing an undefined error
      // Maybe add support for multiple collections later?
      for (var collectionId of metadata.collections.keys()) {
        var collectionObj = metadata.collections.get(collectionId);

        if (collectionObj['@type']){
          mainInfo = "Collection type: " + collectionObj['@type'][0] + "\n";
          if (collectionObj['@type'][0] == ldes+"EventStream"){
            mainInfo += "This is an LDES event stream, all members are immutable";
          }
        }

        // If we did not have a collection stored already add it to jsondata.collection
        if (jsondata.collection.length == 0){
          parseNewCollection(collectionId, collectionObj);
        } else if (testDoubleCollection(collectionId)){
          return;
        }


        // Create view 'nodes' found at the current url this includes nodes not yet dereferenced
        parseViewNodes(collectionObj, metadata, collectionId);

        //Create regular nodes found at the current url, also try and fill any empty view nodes
        parseRegularNodes(collectionObj, metadata, collectionId);

        //Get the data behind all needed import statements then collect all members then call validator function
        getImportsAndMembers(metadata, store, collectionObj, fix);
      }

      // This does not need a duplicate check since old node relations won't be included in the new metadata
      // or they will just overwrite with newer data if the node was already present
      for (var nodeId of metadata.nodes.keys()){
        // Since we might be overwriting, delete old links for this node if already existed to avoid double linking
        jsondata.links.delete(nodeId+"_node");
        var nodeObj = metadata.nodes.get(nodeId);
        jsondata[nodeId+"_node"] = [];
        for (var relation of nodeObj.relation){
          jsondata[nodeId+"_node"].push({"id":relation['@id'], "name":relation['@id']});
        }
      }

      // This will loop through new nodes and add their relations with their attributes
      // This will also link the new nodes to old nodes and vice versa
      parseRelationsAndLinks(metadata);

      console.log("jsondata:");
      console.log(jsondata);

      console.log("members:");
      console.log(members);


      // TODO shape is defined on the collection so shape is never allowed to change
      // Currently we just ignore new shapes instead of checking if they are correct compared to the original
      if (jsondata.shapes.length == 0 && metadata.collections.get(collectionId).shape){
        const shapeIds = getShapeIds(store);

        extractShapeId(store, shapeIds[0]).then(res => {
          jsondata.shapes.push({"id":shapeIds[0], "type":"shape", "shape_extra":res});
          mapAddToSet(jsondata.links, collectionId, shapeIds[0]);
          newImportLinks = new Set();
          callBack();
        });

      } else {
        newImportLinks = new Set();
        callBack();
      }

    })

  });

}


function testDoubleCollection(collectionId){
  // If we already had a collection stored, check to make sure the 'new' one is the same as the old one
  let double = false;
  if (jsondata.collection.length > 0){
    for (let checker of jsondata.collection){
      if (checker.id != collectionId){
        double = true;
      }
    }
  }


  // If the new collection is not the same throw an error
  if (double){
    let errorText = "";
    errorText += "Warning: new node is linked to a different collection. This is not supported.";
    errorText += '\n' + "current URL: " + data_url;
    errorText += '\n' + "new collection: " + collectionId;
    errorText += '\n' + "original collection: " + jsondata.collection[0].id;
    remarks += errorText+"\n";
    alert(errorText);
  }
  return double;
}


function parseNewCollection(collectionId, collectionObj){
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


function parseRelationsAndLinks(metadata){
  let tempN = [];
  let tempN2 = [];
  let tempNMapping = new Map();
  // If metadata.nodes had no new node, a new empty node still got added to the graph
  // Need to ensure a link for all relations leading to this node is also created via data_url_node
  let it = metadata.nodes.keys();
  if (metadata.nodes.size == 0){
    it = [data_url];

    jsondata.links.delete(data_url +"_node");
    jsondata[data_url +"_node"] = [];
  }
  for (let nodeName of it){
    let nodeId = nodeName + "_node"
    //This will hold all newly added nodes to later check if they conform to any already existing relations
    tempN.push(nodeId);
    if(urlMappings.has(nodeName)){
      tempNMapping.set(urlMappings.get(nodeName)+"_node", nodeId);
      tempN2.push(urlMappings.get(nodeName)+"_node");
    }
    jsondata[nodeId].remainingItems = 0;
    for (var relationJson of jsondata[nodeId]){
      if (metadata.relations.get(relationJson.id)){
        parseRelationsAndLinksHelper(relationJson, metadata, nodeId, nodeName);
      }
    }

    AddNewLinks(tempN, tempN2, tempNMapping);
  }
}


function parseRelationsAndLinksHelper(relationJson, metadata, nodeId, nodeName){
  var relationObj = metadata.relations.get(relationJson.id);
  if (!relationObj.node || !relationObj.node[0]['@id']){
    let errM = "Error: relation from " + nodeId + " has no node defined!\nThis is not allowed!\nRelation: " + JSON.stringify(relationObj, null, '\t') + "\n\n";
    remarks += errM;
    // alert(errM);
    return;
  }

  // UNCOMMENT FOR AUTOFOLLOW
  // jsondata.nodes.push({"id":relationObj.node[0]["@id"]+"_node", "name":relationObj.node[0]["@id"]});
  // mapAddToSet(jsondata.links, nodeId, relationObj.node[0]["@id"]+"_node");


  relationJson.node = relationObj.node;

  mapAddToSet(jsondata.relations, nodeId, relationObj.node[0]['@id']+"_node");

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

  createLinkLabels(relationObj, nodeId);

  for (let pAttr of relationSpecial){
    if (relationObj[pAttr]){
      relationJson[pAttr] = relationObj[pAttr];
    }
  }

  //This checks if the node this relation links to already exists in the graph
  if(jsondata[relationObj.node[0]['@id']+"_node"]){
    mapAddToSet(jsondata.links, nodeId, relationObj.node[0]['@id']+"_node");
  }

  if(urlMappings.has(relationObj.node[0]['@id']) && jsondata[urlMappings.get(relationObj.node[0]['@id'])+"_node"]){
    mapAddToSet(jsondata.links, nodeId, urlMappings.get(relationObj.node[0]['@id'])+"_node");
  }
}


function createLinkLabels(relationObj, nodeId){
  if (relationObj["value"]){
    let vT = "";
    for (let vX of relationObj["value"]){
      vT += vX["@value"] + ", ";
    }
    vT = vT.slice(0,-2);
    if (relationObj["@type"] && relationObj["@type"][0]){
      relationLabelMap.set(nodeId + relationObj.node[0]['@id']+"_node", relationObj["@type"][0].split('#')[1] + " " + vT);
    } else {
      relationLabelMap.set(nodeId + relationObj.node[0]['@id']+"_node", "relation: " + vT);
    }
  } else if (relationObj["@type"] && relationObj["@type"][0]){
    relationLabelMap.set(nodeId + relationObj.node[0]['@id']+"_node", relationObj["@type"][0].split('#')[1]);
  }
}


function AddNewLinks(tempN, tempN2, tempNMapping){
  //This checks if any of the newly added nodes are the target of a relation already on the graph
  for (let [tempKey, tempSet] of jsondata.relations){
    for (let tempValue of tempSet){
      if (tempN.includes(tempValue)){
        mapAddToSet(jsondata.links, tempKey, tempValue);
      } else if (tempN2.includes(tempValue)){
        mapAddToSet(jsondata.links, tempKey, tempNMapping.get(tempValue));
      }
    }
  }
}



function parseRegularNodes(collectionObj, metadata, collectionId){
  // view 'nodes' have been added, now add the actual nodes
  // Also checks if a new node is already a 'view', if so, replace it in view
  // the original in view was either the same full node or an empty view that got found but not dereferenced
  // -> important notice a node can be in both .subset and .view if both attributes were defined
  let iter = [];
  if (collectionObj.subset){
    iter = iter.concat(collectionObj.subset);
  }
  if (metadata.nodes){
    iter = iter.concat(Array.from(metadata.nodes.values()));
  }

  if (collectionObj.subset || metadata.nodes){
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
          mapAddToSet(jsondata.links, collectionId, viewNode['@id']+"_node");
        } else {
          node.type = "Node";
          jsondata.nodes.push(node);
        }

      }
    }
  }
}



function parseViewNodes(collectionObj, metadata, collectionId){
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
        if(data_url == node.name){
          node.relation_count = 0;
        }
        jsondata.views.push(node)
        mapAddToSet(jsondata.links, collectionId, viewNode['@id']+"_node");

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
        mapAddToSet(jsondata.links, collectionId, viewNode['@id']+"_node");
      }
    }
  }
}


function getImportsAndMembers(metadata, store, collectionObj, fix){
  // get all imports & afterwards start shacl validation
  if(metadata.nodes && metadata.nodes.size > 0){
    var newNodeMembersId = [];
    if (metadata.nodes.size > 0){
      newNodeMembersId = Array.from(metadata.nodes.keys());
    } else {
      newNodeMembersId = [data_url];
    }
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
        .on('error', (error) => {console.error(error); let errM = "Error while parsing import data at:\n"+url+"\n\n" +error+"\n"; remarks+= errM;/*alert(errM); */reject()})
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
        remarks += "Found no members at " + data_url + ".\n";
        fix();
      }
    });
  } else {
    fix();
  }
}



async function validateShape(membIds, store, newNodeMembersId, fix){
  for (let mId of newNodeMembersId){
    membersFailed[mId] = [];
    node_validation[mId] = {};
  }

  const shapeIds = getShapeIds(store);

  if (shapeIds.size > 1){
    let errM = "Found multiple shapes, will only validate using the first one.\n" + JSON.stringify(shapeIds);
    // alert(errM);
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
      fix();
    }).catch((e) => {
      console.error("Error with members while validating\n"+e);
      fix();
    });
  }).catch((e) => {
    console.error("Error with shape while validating\n"+e);
    fix();
  });

}
