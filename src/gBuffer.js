function gBuffer(_size) {
	this.size = 4096 || _size;
}

gBuffer.prototype = {
	constructor: gBuffer(),

	setupBuffers: function(_size) {
		var size = this.size || _size;
		var positionBuffer = app.createTexture2D(size, size , {
			type: PicoGL.FLOAT,
			internalFormat: PicoGL.RBGA32F,
			minFilter: PicoGL.NEAREST,
			magFilter: PicoGL.NEAREST
		});
		
		var normalbuffer = app.createTexture2D(size, size, {
			minFilter: PicoGL.NEAREST,
			magFilter: PicoGL.NEAREST
		});

		var colorBuffer = app.createTexture2D(size, size, {
			minFilter: PicoGL.NEAREST,
			magFilter: PicoGL.NEAREST
		});

		this.frameBuffer = app.createFramebuffer()
		.colorTarget(0, positionBuffer)
		.colorTarget(1, normalbuffer)
		.colorTarget(2, colorBuffer);
	}
}