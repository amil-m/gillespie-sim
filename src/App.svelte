<script>
 import * as Plot from "@observablehq/plot";
 import * as d3 from "d3";

 import Gillespie from "./lib/gillespie.js";
 import matrix from "./lib/matrix.js";
 import nodesplot from './assets/100_nodes.svg'

 const A = matrix;

 let R_0 = 2; // Rate of infection
 let k = 10; // Target average degree of network

 let I_0 = 5;
 let gamma = 1 / 5;
 let dt = 0.1;
 let Tend = 50;
 let seed = null;
 let sim_repeat = 100;

 let sims = null;
 let raw_sims = null;
 let mean_infections = null;
 let final_epidemic_size = null;

 let chart;
 let histogram;

 async function simulate() {
     let tau = (R_0 * gamma) / (k - 1 - R_0);

     // Create 100 simulation promises
     let promises = [];
     for (let i = 0; i < sim_repeat; i++) {
         let _sim = new Gillespie(A, I_0, tau, gamma, Tend, dt, seed, i);
         promises.push(_sim.simulate())
     }

     // Resolve all promises
     sims = await Promise.all(promises)

     // Get raw data and combine from all sims
     raw_sims = [];
     final_epidemic_size = [];
     sims.forEach((s)=>{
         raw_sims.push(...s.raw)
         // Get the last element from each sim
         final_epidemic_size.push(s.raw.at(-1))
     })

     // Get interpolated values and combine from each sim
     let interpolated = [];
     sims.forEach((s) => {
         interpolated.push(...s.interpolated)
     })

     // Group interpolated data by time and average
     let _infections = d3.rollup(interpolated, v => d3.mean(v, d => d.infected), d => d.time)
     mean_infections = Array.from(_infections, ([time, mean]) => ({
         time: time,
         mean: mean
     }));
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
         y: { label: "Nodes", grid: true, domain: [0, A.length] },
         x: { label: "Time", domain: [0, Tend] },
         marks: [
             Plot.lineY(raw_sims, {
                 x: "time",
                 y: "infected",
                 z: "sim",
                 stroke: "#b3b3b3",
                 strokeOpacity: 0.2
             }),
             Plot.lineY(mean_infections, {
                 x: "time",
                 y: "mean",
                 stroke: "#206095",
                 strokeWidth: 3.5
             }),
             Plot.ruleY([0]),
         ],
     }));
 }

 $: {
     histogram?.firstChild?.remove();
     histogram?.append(Plot.plot({
         width: 720,
         height: 120,
         y: { label: "Nodes", grid: true, domain: [0, A.length] },
         x: { label: "Recovered", domain: [0, A.length] },
         marks: [
             Plot.rectY(final_epidemic_size,
                        Plot.binX({y: "count"}, {x: "recovered", x1: 0, x2: 100, inset: 0})
             ),
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
    {#if sims}
        <figure>
            <div bind:this={chart} role="img" id="chart" style="margin-top: 2rem; margin-bottom: 2rem"></div>
            <figcaption>Infected</figcaption>
        </figure>
        <hr/>

        <figure>
            <div bind:this={histogram} role="img" id="chart" style="margin-top: 2rem"></div>
            <figcaption>Final Epidemic Size</figcaption>
        </figure>
    {/if}

    <div style="text-align: right; margin-top: 2.5rem">
        <button on:click={() => simulate()}>Run Simulation</button>
    </div>

    <details style="margin-top: 1rem;">
        <summary>Simulation Settings</summary>
        <div class="grid">
            <div>
                <label>Reproduction number</label>
                <input bind:value={R_0} name="r0" on:input={()=>simulate()}>
            </div>

            <div>
                <label>Initial infected</label>
                <input bind:value={I_0} type="number" min=1 max=100 name="i0" on:input={()=>simulate()}>
            </div>


            <div>
                <label>Recovery rate (gamma)</label>
                <input bind:value={gamma} name="gamma" on:input={()=>simulate()}/>
            </div>

            <div>
                <label>Time to end</label>
                <input bind:value={Tend} type="number" step=100 name="tend" on:input={()=>simulate()}>
            </div>

            <div>
                <label>Repeat simulations</label>
                <input bind:value={sim_repeat} name="seed" on:input={()=>simulate()}>
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
