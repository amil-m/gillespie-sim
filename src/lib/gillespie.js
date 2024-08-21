import * as d3 from "d3";

class Gillespie {
  #interpolated_values = null;
  #raw_values = null;
  constructor(A, I_0, tau, gamma, dt, Tend, seed = null) {
    /**
       --------------------------------------------------------------------------
       (A) adj = nxn adjacency matrix
       (I_0) initial = number of inital infected.
       tau = Infection rate
       (gamma) Rr  = recovery rate.
       dt = discretization of time
       (Tend) = Time to end
       seed = Seed (0-1)
       -------------------------------------------------------------------------
    **/

    // Set seed
    this.seed = seed || d3.randomUniform()();
    this.#setSeed();

    this.time_increment = 0.5;

    this.A = A; // nxn adjacency matrix
    this.I_0 = I_0; // Intial number of infected
    this.tau = tau; // Infection rate
    this.gamma = gamma; // recovery rate
    this.dt = dt; // discreetization of time
    this.Tend = Tend; // Time to end

    this.N = A.length; // Number of nodes

    // Arrays to hold states
    this.S = [this.N - I_0]; // Susceptible
    this.I = [I_0]; // Infected
    this.R = [0]; // Recovered
    this.T = [0]; // Time

    // Create array representing each node
    // 0 - uninfected, 1 - infected, 2 - recovered
    this.state = new Array(this.N).fill(0);
    // Set nodes 0 to I_0 (inital infected) as infected (1) in state and shuffle
    this.state.fill(1, 0, I_0);
    this.shuffle(this.state);

    // Initialise a rate vector array
    this.rate_vector = new Array(this.N).fill(0);

    // Intialise individual node states
    this.#initialiseNodes();

    // Logging
    this.rate_vector_history = [[...this.rate_vector]];
    this.state_history = [[...this.state]];
    this.event_node_history = [];

    // Simulation time taken (ms)
    this.sim_duration = 0;

    // Interpolated values of sim
    this.#interpolated_values = null;
    this.raw_results = null;
  }

  #setSeed() {
    // Set seeds of random number
    const source = d3.randomLcg(this.seed);
    this.shuffle = d3.shuffler(source);
    this.randomUniform = d3.randomUniform.source(source);
    this.randomExponential = d3.randomExponential.source(source);
  }

  #initialiseNodes() {
    // Calculate rate vector for each node
    for (const [index, value] of this.state.entries()) {
      switch (value) {
        // Node is uninfected
        case 0:
          // Get neighbours from adjacency matrix
          let neighbours = this.#findNeighbours(index);

          // Iterate through each neighbour
          neighbours.forEach((n) => {
            // Check if they are infected
            if (this.state[n] === 1) {
              // Increase rate vector for current node by infection rate (tau)
              this.rate_vector[index] += this.tau;
            }
          });
          break;

        // Infected node
        case 1:
          // Set value of rate vector for current node to recovery rate (gamma)
          this.rate_vector[index] = this.gamma;
          break;
      }
    }
  }

  async simulate() {
    return new Promise(
      function (resolve, reject) {
        const sim_start = performance.now();

        // MATLAB uses 1-based indexing (Istvans code started at 2)
        // Start a time step counter at the first step
        let t = 1;
        let time = 0;

        // Whilst in duration of simulation time (Tend) + 0.5
        while (time <= this.Tend + this.time_increment) {
          // Initialise current state by getting values from previous step
          this.S[t] = this.S[t - 1]; // Susceptible
          this.I[t] = this.I[t - 1]; // Infected
          this.R[t] = this.R[t - 1]; // Recovered

          // Calculate total and cumulative sum of rate vector
          let rate = d3.sum(this.rate_vector);
          let rate_cumulative = d3.cumsum(this.rate_vector);

          // Stop simualtion if infection is no longer active
          if (rate < 0.000001) break;

          // Generate random time for event, d3 returns a function
          let tstep = this.randomExponential(rate)();
          // Add random value to previous step time and append to Time array at current point
          this.T[t] = this.T[t - 1] + tstep;

          // Choose a random node for event to take place
          // Event = find(Cum > rand(1,1)*rate, 1);
          // https://uk.mathworks.com/help/matlab/ref/find.html
          // rand(1,1) -> random number 0 and 1 then multiply by rate

          // Find index of rate_cumulative where the value is greater than
          // a random number multiplied by rate
          let rand_rate = this.randomUniform(1)() * rate;
          let event_node = rate_cumulative.findIndex((val) => val > rand_rate);
          this.event_node_history.push(event_node);

          // Check that we have an event_node otherwise end sim
          if (event_node === -1) break;

          // Find susceptible neighbours of event_node
          let neighbours = this.#findNeighbours(event_node);
          let susceptible_neighbours = neighbours.filter(
            (n) => this.state[n] === 0,
          );

          // Outcomes for infected and uninfected states of event_node
          switch (this.state[event_node]) {
            // Uninfected
            case 0:
              // Update susceptible, infected states
              this.S[t]--;
              this.I[t]++;
              this.state[event_node] = 1;
              this.rate_vector[event_node] = this.gamma;

              // Iterate though each susceptible neighbour and increase infection rate (tau)
              for (const s_n of susceptible_neighbours) {
                this.rate_vector[s_n] += this.tau;
              }
              break;

            // Infected
            case 1:
              // Node recovers
              // Update infected, recovered states
              this.I[t]--;
              this.R[t]++;
              this.state[event_node] = 2; // 2 so that the node is not considered again
              this.rate_vector[event_node] = 0;

              // Iterate though each susceptible neighbour and decrease infection rates (tau)
              for (const s_n of susceptible_neighbours) {
                this.rate_vector[s_n] -= this.tau;
              }
              break;
          }

          // Logging
          this.rate_vector_history.push([...this.rate_vector]);
          this.state_history.push([...this.state]);

          // Iterate time counters
          time = this.T[t];
          t++;
        }

        // Draw straight line to end if simulation exited before Tend
        if (time < this.Tend + this.time_increment) this.#extendSimEnd(t);

        // Interpolate values and resolve promise
        this.simulated = true;
        this.#interpolateValues();
        const sim_end = performance.now();
        this.sim_duration = sim_end - sim_start;
        resolve(
          `Simulation completed in ${this.sim_duration} ms. with seed ${this.seed}`,
        );
      }.bind(this),
    );
  }

  #extendSimEnd(t) {
    // Get last step of simulation
    let time = this.T[t - 1];

    // Find last S, I and R values
    let last_S = this.S[t - 1];
    let last_I = this.I[t - 1];
    let last_R = this.R[t - 1];

    // Start a loop on the remaining time and draw a straight line to end
    while (time <= this.Tend + this.time_increment) {
      // States stay constant
      this.S[t] = last_S;
      this.I[t] = last_I;
      this.R[t] = last_R;
      // Increment time
      this.T[t] = this.T[t - 1] + this.time_increment;
      time = this.T[t];
      t++;
    }
  }

  #interpolateValues() {
    // Interpolation - Produce evenly spaced time points
    // Each time point in simulation does not currently represent a uniform unit of time

    // Calculate number of points we need to create
    // M = Tend/dt + 1;
    let M = Math.floor(this.Tend / this.dt);

    // Raw results data
    let raw = [];
    this.T.forEach((value, index) => {
      // Put matching values inside the results array
      raw.push({
        index: index,
        time: value,
        susceptible: this.S[index],
        infected: this.I[index],
        recovered: this.R[index],
      });
    });

    this.#raw_values = raw;

    // For each interpolated point, get the closest point from simulation time (T)
    let interpolated = [];
    for (let point = 0; point <= M; point++) {
      // k=find(T<=(jj-1)*dt,1,'last');
      // Use scale function to determine time at index
      const point_time = point * this.dt; // Should this be (point - 1) * dt?

      // Find the last index of Time (T) where the value is less than interpolated time (value)
      // Implemented as: find first index *greater than* current value and take the index before that
      let k = this.T.findIndex((t) => t > point_time) - 1;
      // k is -2 if we cannot find an index, so replace with last index of Time
      if (k === -2) k = this.T.at(-1);

      // Put matching values inside the results array
      interpolated.push({
        //time: Ti_scale(point),
        time: point_time,
        susceptible: this.S[k],
        infected: this.I[k],
        recovered: this.R[k],
      });
    }

    this.#interpolated_values = interpolated;
  }

  get data() {
    // Getter for simulation results
    if (!this.intepolated_values === null)
      throw new Error("Simulation not started");
    return {
      interpolated: this.#interpolated_values,
      raw: this.#raw_values,
    };
  }

  #findNeighbours(node) {
    // Get index of neighbours from adjacency matrix for a node
    return this.A[node]
      .map((value, index) => {
        // Return value of index of neighbour otherwise -1
        if (value === 1) {
          return index;
        } else {
          return -1;
        }
      })
      .filter((index) => index !== -1);
  }
}

export default Gillespie;
