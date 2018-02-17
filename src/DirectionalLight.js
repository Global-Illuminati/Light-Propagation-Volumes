
function DirectionalLight(direction, color) {

	this.direction = direction || vec3.fromValues(0.3, -1.0, 0.3);
	vec3.normalize(this.direction, this.direction);

	this.color = color || new Float32Array([1.0, 1.0, 1.0]);

}

DirectionalLight.prototype = {

	constructor: DirectionalLight,

	viewSpaceDirection: function(camera) {

		var inverseRotation = quat.conjugate(quat.create(), camera.orientation);

		var result = vec3.create();
		vec3.transformQuat(result, this.direction, inverseRotation);

		return result;

	}

};