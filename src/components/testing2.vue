<template>

  <p>Click a bubble to show all attributes</p>
  <p>ctrl+click a relation to navigate to the node</p>

  <label for="adecay">Enter graph convergence speed, between 0 and 1</label>
  <input type="number" v-model="alpha_decay_rate" placeholder="0.023" name="adecay"><br>

  <label for="width">Enter prefered graph width: </label>
  <input type="number" v-model="graph_width" placeholder="400" name="width"><br>

  <label for="height">Enter prefered graph height: </label>
  <input type="number" v-model="graph_height" placeholder="400" name="height"><br>

  <label for="url">Enter URL: </label>
  <input type="url" v-model="data_url" placeholder="URL" name="url"><br>

  <button v-on:click="getData">Draw Graph</button><br>

  <div id="my_dataviz" style="overflow:scroll"></div>

  <div id="extra" style="overflow:scroll"></div>

  <p>{{jsondata}}</p>

</template>


<script>

// import rdfDereferencer from "rdf-dereference";
// import 'setimmediate';
// import * as d3 from "d3";
// const extractMetadata = require('@treecg/tree-metadata-extraction').extractMetadata

const fs = require('fs')
const factory = require('rdf-ext')
const ParserN3 = require('@rdfjs/parser-n3')
const SHACLValidator = require('rdf-validate-shacl')

export default {
  name: 'App',
  components: {
  },
  data(){
    return {
      qtext: [],
      jsondata: {"collection":[], "nodes":[], "relations":[], "links":[], "shapes":[], "relations_holder":[]},
      next_url: "",
      checked_shape: false,
      graph_height: 600,
      graph_width: 1000,
      data_url: null,
      alpha_decay_rate: 0.5//1 - Math.pow(0.001, 1 / 300)
    }
  },
  methods : {
    async getData() {

      //var standardURL = 'https://raw.githubusercontent.com/TREEcg/demo_data/master/stops/.root.nt'

      async function loadDataset (filePath) {
        const stream = fs.createReadStream(filePath)
        const parser = new ParserN3({ factory })
        return factory.dataset().import(parser.import(stream))
      }

      const shapes = await loadDataset('my-shapes.ttl')
      const data = await loadDataset('my-data.ttl')

      const validator = new SHACLValidator(shapes, { factory })
      const report = await validator.validate(data)

      // Check conformance: `true` or `false`
      console.log(report.conforms)

      for (const result of report.results) {
        // See https://www.w3.org/TR/shacl/#results-validation-result for details
        // about each property
        console.log(result.message)
        console.log(result.path)
        console.log(result.focusNode)
        console.log(result.severity)
        console.log(result.sourceConstraintComponent)
        console.log(result.sourceShape)
      }

      // Validation report as RDF dataset
      console.log(report.dataset)
    }
  }
}
</script>
