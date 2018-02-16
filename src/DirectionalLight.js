
function DirectionalLight(direction, color) {

	this.direction = direction || vec3.fromValues(0.3, -1.0, 0.3);
	vec3.normalize(this.direction, this.direction);

	this.color = color || [1, 1, 1];

}

DirectionalLight.prototype = {

	constructor: DirectionalLight

};