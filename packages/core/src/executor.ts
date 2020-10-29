export const execute = (jobs: (() => Promise<any>)[], concurrency = 100) => {
  let workers = 0;
  let index = 0;

  return new Promise(done => {
    const finished = index => result => {
      jobs[index] = result;
      workers--;
      tick();
    };
    const tick = () => {
      if (workers < concurrency && index < jobs.length) {
        jobs[index]().then(finished(index)).catch(finished(index));
        ++index && ++workers;
        tick();
      } else if (workers === 0 && index === jobs.length) {
        done(jobs);
      }
    };
    tick();
  });
};
