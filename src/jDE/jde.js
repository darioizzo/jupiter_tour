// Generated by CoffeeScript 1.6.1

/*
 Coffee script implementation of jde based on
    Brest, J., V. Zumer, and M. Sepesy Maucec. 
    "Self-adaptive differential evolution algorithm in constrained real-parameter optimization." 
    Evolutionary Computation, 2006. CEC 2006. IEEE Congress on. IEEE, 2006. 
 
 @author: mmarcusx@gmail.com
*/


/*
    classes
*/


(function() {

  test.rastrigin = (function() {

    function rastrigin(dim) {
      var x;
      this.bounds = (function() {
        var _i, _results;
        _results = [];
        for (x = _i = 1; 1 <= dim ? _i <= dim : _i >= dim; x = 1 <= dim ? ++_i : --_i) {
          _results.push([-5.12, 5.12]);
        }
        return _results;
      })();
      this.dim = dim;
    }

    rastrigin.prototype.objfun = function(x) {
      var omega, s, xi;
      omega = 2.0 * Math.PI;
      s = (function() {
        var _i, _len, _results;
        _results = [];
        for (_i = 0, _len = x.length; _i < _len; _i++) {
          xi = x[_i];
          _results.push(xi * xi - 10.0 * Math.cos(omega * xi));
        }
        return _results;
      })();
      return arr_sum(s) + this.dim * 10;
    };

    rastrigin.prototype.feasible = function(x) {
      var elem, i, _i, _len;
      for (i = _i = 0, _len = x.length; _i < _len; i = ++_i) {
        elem = x[i];
        if (!((this.bounds[i][0] <= elem && elem <= this.bounds[i][1]))) {
          return false;
        }
      }
      return true;
    };

    return rastrigin;

  })();

  core.individual = (function() {

    function individual(prob) {
      var b;
      this.x = (function() {
        var _i, _len, _ref, _results;
        _ref = prob.bounds;
        _results = [];
        for (_i = 0, _len = _ref.length; _i < _len; _i++) {
          b = _ref[_i];
          _results.push(Math.random() * (b[1] - b[0]) + b[0]);
        }
        return _results;
      })();
      this.f = prob.objfun(this.x);
    }

    return individual;

  })();

  core.jde = (function() {

    function jde(variant) {
      if (variant == null) {
        variant = 2;
      }
      this.variant = variant;
    }

    jde.prototype.evolve = function(pop, prob, gen) {
      var L, best_idx, cr, f, i, ind, ind1_chr, ind2_chr, ind3_chr, j, k, mutant, n, new_chr, new_ind, new_pop, pop_cr, pop_f, r, sure_cross_idx, tmp_pop, v, _i, _j, _k, _l, _len, _len1, _len2, _ref;
      if (gen === 0) {
        return pop;
      }
      if (pop.length < 8) {
        throw 'The population needs to be at least 8 to evolve with jDE';
        return pop;
      }
      pop_f = (function() {
        var _i, _ref, _results;
        _results = [];
        for (i = _i = 1, _ref = pop.length; 1 <= _ref ? _i <= _ref : _i >= _ref; i = 1 <= _ref ? ++_i : --_i) {
          _results.push(Math.random() * 0.9 + 0.1);
        }
        return _results;
      })();
      pop_cr = (function() {
        var _i, _ref, _results;
        _results = [];
        for (i = _i = 1, _ref = pop.length; 1 <= _ref ? _i <= _ref : _i >= _ref; i = 1 <= _ref ? ++_i : --_i) {
          _results.push(Math.random());
        }
        return _results;
      })();
      for (i = _i = 1; 1 <= gen ? _i <= gen : _i >= gen; i = 1 <= gen ? ++_i : --_i) {
        best_idx = championidx(pop);
        new_pop = [];
        for (j = _j = 0, _len = pop.length; _j < _len; j = ++_j) {
          ind = pop[j];
          tmp_pop = arr_takeout(pop, j);
          r = arr_choice(tmp_pop, 3);
          ind1_chr = tmp_pop[r[0]].x.slice(0);
          ind2_chr = tmp_pop[r[1]].x.slice(0);
          ind3_chr = tmp_pop[r[2]].x.slice(0);
          f = Math.random() >= 0.9 ? Math.random() * 0.9 + 0.1 : pop_f[j];
          cr = Math.random() >= 0.9 ? Math.random() : pop_cr[j];
          mutant = arr_add(ind1_chr, arr_scalar(arr_add(ind2_chr, arr_scalar(ind3_chr, -1.0)), f));
          if (!prob.feasible(mutant)) {
            for (k = _k = 0, _len1 = mutant.length; _k < _len1; k = ++_k) {
              v = mutant[k];
              mutant[k] = random_real(prob.bounds[k][0], prob.bounds[k][1]);
            }
          }
          if (this.variant === 1) {
            new_chr = [];
            sure_cross_idx = random_int(0, prob.dim - 1);
            _ref = ind.x;
            for (k = _l = 0, _len2 = _ref.length; _l < _len2; k = ++_l) {
              v = _ref[k];
              if ((Math.random() <= cr) || (k === sure_cross_idx)) {
                new_chr.push(mutant[k]);
              } else {
                new_chr.push(ind.x[k]);
              }
            }
          } else if (this.variant === 2) {
            n = random_int(0, prob.dim - 1);
            new_chr = ind.x.slice(0);
            L = 0;
            while (true) {
              new_chr[n] = mutant[n];
              n = (n + 1) % prob.dim;
              ++L;
              if ((Math.random() >= cr) || (L >= prob.dim)) {
                break;
              }
            }
          } else {
            throw "jDE variant unknown, evolution aborted!";
            return pop;
          }
          new_ind = {
            x: new_chr,
            f: prob.objfun(new_chr)
          };
          if (new_ind.f < ind.f) {
            new_pop.push(new_ind);
            pop_f[j] = f;
            pop_cr[j] = cr;
          } else {
            new_pop.push(ind);
          }
        }
        pop = new_pop;
      }
      return pop;
    };

    return jde;

  })();

  /* 
      functions
  */


  test.gen_rastrigin = function() {
    var dim, prob, v;
    v = document.getElementById('dimfield').value;
    if ((1 <= v && v <= 99)) {
      dim = v;
    } else {
      dim = 10;
      document.getElementById('dimfield').value = 10;
    }
    prob = new test.rastrigin(dim);
    document.getElementById('popbutton').disabled = false;
    return prob;
  };

  test.gen_pop = function(prob) {
    var i, p, v;
    v = document.getElementById('popfield').value;
    if ((8 <= v && v <= 999)) {
      p = v;
    } else {
      p = 100;
      document.getElementById('popfield').value = 100;
    }
    this.alg = new core.jde();
    this.pop = (function() {
      var _i, _results;
      _results = [];
      for (i = _i = 1; 1 <= p ? _i <= p : _i >= p; i = 1 <= p ? ++_i : --_i) {
        _results.push(new core.individual(prob));
      }
      return _results;
    })();
    document.getElementById('evolvebutton').disabled = false;
    return 0;
  };

  test.evolve = function(prob) {
    var k, s, v, _i, _len, _ref;
    v = parseInt(document.getElementById('genfield').value);
    if ((1 <= v && v <= 5000)) {
      document.getElementById('evolvebutton').disabled = true;
      this.pop = this.alg.evolve(this.pop, prob, v);
      document.getElementById('evolvebutton').disabled = false;
      s = '<p>current fitness: ' + this.pop[championidx(this.pop)].f + '<p/>';
      s += 'decision vector: <ul>';
      _ref = this.pop[championidx(this.pop)].x;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        k = _ref[_i];
        s += '<li>' + k + '</li>';
      }
      s += '</ul>';
      document.getElementById('output').innerHTML = s;
    } else {
      alert('Enter a number of generations between 1 and 5000');
    }
    return 0;
  };

}).call(this);
