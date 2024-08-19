<script>
 import * as Plot from "@observablehq/plot";
 import Gillespie from "./lib/gillespie.js";
 import matrix from "./lib/matrix.js";
 import nodesplot from './assets/100_nodes.svg'

 const A = matrix;

 let R_0 = 2; // Rate of infection
 let k = 10; // Target average degree of network

 let I_0 = 5;
 let gamma = 1 / 5;
 $:tau = (R_0 * gamma) / (k - 1 - R_0);
 let dt = 0.1;
 let Tend = 1000;
 let seed = null

 let sim = null;

 let chart;

 async function simulate() {
   let _sim = new Gillespie(A, I_0, tau, gamma, dt, Tend, seed);
   let _ = await _sim.simulate();
   console.log(_);
   sim = _sim;
 }

 (async () => {
   await setTimeout(1000);
   await simulate();
 })();

 $: {
   chart?.firstChild?.remove();
   chart?.append(Plot.plot({
     width: 720,
     inset: 10,
     color: {
       domain: ["Susceptible", "Infected", "Recovered"],
       range: ["green", "red", "grey"],
       legend: true,
     },
     y: { label: "Nodes", grid: true, domain: [0, A.length] },
     x: { label: "Time" },
     marks: [
       //Plot.text(["Interpolated Data"], { frameAnchor: "Top" }),
       Plot.ruleY([0]),
       Plot.lineY(sim.data, {
         x: "time",
         y: "susceptible",
         stroke: "green",
       }),
       Plot.lineY(sim.data, {
         x: "time",
         y: "infected",
         stroke: "red",
       }),
       Plot.lineY(sim.data, {
         x: "time",
         y: "recovered",
         stroke: "grey",
       }),
     ],
   }));
 }
</script>

<header>
  <div>
    <h1>Gillespie Simulations</h1>
  </div>
</header>

<main>


  {#if sim}
    <div bind:this={chart} role="img" style="margin-top: 2rem"></div>
  {/if}

  <div style="text-align: right; margin-top: 2.5rem">
    <button on:click={() => simulate()}>Run Simulation</button>
  </div>

  <details style="margin-top: 1rem;">
    <summary>Simulation Settings</summary>
    <div class="grid">
      <div>
        <label>Rate of infection</label>
        <input bind:value={R_0} name="r0">
      </div>

      <div>
        <label>Initial infected</label>
        <input bind:value={I_0} type="number" min=1 max=100 name="i0">
      </div>


      <div>
        <label>Recovery rate (gamma)</label>
        <input bind:value={gamma} name="gamma" />
      </div>

      <div>
        <label>Time to end</label>
        <input bind:value={Tend} type="number" step=100 name="tend">
      </div>

      <div>
        <label>Discreetisation of time (dt)</label>
        <input bind:value={dt} name="dt" />
      </div>

      <div>
        <label>Seed</label>
        <input bind:value={seed} name="seed">
      </div>

    </div>
  </details>


  <section>
      <h2>Graph Information</h2>
      <img src={nodesplot} alt="Visualisation of graph">
      <p>This simulation uses a 100 node random network with a desired average degree of ten. It was produced using the following code:

      <pre>import json
import networkx as nx

N = 100  # Number of nodes
k_avg = 10  # Desired average degree

# Calculate the probability of connection
p = k_avg / (N - 1)

# Create the graph
G = nx.erdos_renyi_graph(N, p, seed=12345)

# Generate matrix
json.dumps(nx.adjacency_matrix(G).todense().tolist())</pre>
  </section>

</main>

<footer>
    <p></p>
</footer>

<style>
 .grid {
   grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
   display: grid;
   grid-gap: 10px;
 }

 h2 {
     font-size: clamp(1rem, 4vw, 1.5rem);
 }
</style>
