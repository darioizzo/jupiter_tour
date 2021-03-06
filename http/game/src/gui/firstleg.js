/* Class FirstLeg 
    Inherits THREE.Line
*/
gui.FirstLeg = function (chromosome, currentBody, nextBody) {
    chromosome = chromosome.clone();

    var legPoints = [];
    var sgp = currentBody.getCentralBody().getStandardGravitationalParameter();

    var theta = 2 * Math.PI * chromosome[1];
    var phi = Math.acos(2 * chromosome[2] - 1) - Math.PI / 2;
    var velocityInf = new geometry.Vector3(chromosome[3] * Math.cos(phi) * Math.cos(theta), chromosome[3] * Math.cos(phi) * Math.sin(theta), chromosome[3] * Math.sin(phi));

    var ephCOBody = currentBody.orbitalStateVectorsAtEpoch(chromosome[0]);
    var ephNOBody = nextBody.orbitalStateVectorsAtEpoch(chromosome[0] + chromosome[5]);
    var velocityInfAbs = velocityInf.clone().add(ephCOBody.velocity);
    var position = ephCOBody.position.clone();
    var velocity = velocityInfAbs.clone();

    var propLagr = astrodynamics.propagateLagrangian(position, velocity, chromosome[4] * chromosome[5] * utility.DAY_TO_SEC, sgp);

    var dt = (1 - chromosome[4]) * chromosome[5] * utility.DAY_TO_SEC;
    var lambertProb = astrodynamics.lambertProblem(sgp, propLagr.position, ephNOBody.position, dt);

    this._arrivingVelocityInf = lambertProb.velocity2.clone().sub(ephNOBody.velocity);

    legPoints.push(ephCOBody.position.asTHREE().multiplyScalar(gui.POSITION_SCALE));

    var tmpPropLagr = {
        position: ephCOBody.position,
        velocity: velocity
    };

    for (var i = 0; i < 1000; i++) {
        var tmpPropLagr2 = astrodynamics.propagateLagrangian(tmpPropLagr.position, tmpPropLagr.velocity, (chromosome[4] * chromosome[5] * utility.DAY_TO_SEC) / 1000, sgp);
        legPoints.push(tmpPropLagr2.position.asTHREE().multiplyScalar(gui.POSITION_SCALE));
        tmpPropLagr = tmpPropLagr2;
    }

    legPoints.push(propLagr.position.asTHREE().multiplyScalar(gui.POSITION_SCALE));

    tmpPropLagr = {
        position: propLagr.position,
        velocity: lambertProb.velocity1
    };

    for (var i = 0; i < 1000; i++) {
        var tmpPropLagr2 = astrodynamics.propagateLagrangian(tmpPropLagr.position, tmpPropLagr.velocity, ((1 - chromosome[4]) * chromosome[5] * utility.DAY_TO_SEC) / 1000, sgp);
        legPoints.push(tmpPropLagr2.position.asTHREE().multiplyScalar(gui.POSITION_SCALE));
        tmpPropLagr = tmpPropLagr2;
    }

    legPoints.push(ephNOBody.position.asTHREE().multiplyScalar(gui.POSITION_SCALE));

    var spline = new THREE.SplineCurve3(legPoints);
    var meshGeometry = new THREE.Geometry();
    var splinePoints = spline.getPoints(1000);

    for (var i = 0; i < splinePoints.length; i++) {
        meshGeometry.vertices.push(splinePoints[i]);
    }

    var material = new THREE.LineBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        wireframe_linewidth: 3,
        linewidth: 1,
        opacity: 0.1
    });

    THREE.Line.call(this, meshGeometry, material);
};
gui.FirstLeg.prototype = Object.create(THREE.Line.prototype);
gui.FirstLeg.prototype.constructor = gui.FirstLeg;

gui.FirstLeg.prototype.getArrivingVelocityInf = function () {
    return this._arrivingVelocityInf.clone();
};

gui.FirstLeg.prototype.getDepartingVelocityInf = function () {
    return this._departingVelocityInf.clone();
};

gui.FirstLeg.prototype.setGradient = function (value) {
    value = Math.max(0, Math.min(1, value));
    this.material.opacity = 1;
    this.material.transparent = true;
    var red = 1 - value;
    var green = value;
    this.material.color.setRGB(red, green, 0);
};