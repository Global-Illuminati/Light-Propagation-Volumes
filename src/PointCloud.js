function RSMPointCloud(_size) {
    this.size = _size || 4096;
    this.framebuffer = this.createFramebuffer(32);
    console.log(this.size);
}

RSMPointCloud.prototype = {
    constructor: RSMPointCloud,

    createPointCloud: function() {
        const positionData = new Float32Array(this.size * this.size * 2);

        let positionIndex = 0;
        for (let x = 0; x < this.size; x++) {
            for (let y = 0; y < this.size; y++) {
                positionData[positionIndex++] = x;
                positionData[positionIndex++] = y;
            }
        }

        const pointPositions = app.createVertexBuffer(PicoGL.FLOAT, 2, positionData);

        const pointArray = app.createVertexArray()
        .vertexAttributeBuffer(0, pointPositions);

        return pointArray;
    },

    createDrawCall: function(_shader) {
    this.drawCall = app.createDrawCall(_shader, this.createPointCloud(), PicoGL.POINTS);
        
        return this.drawCall;
    },

    createFramebuffer: function(_size) {
        this.framebufferSize = _size || 32;
        const redBuffer = app.createTexture2D(this.framebufferSize * this.framebufferSize, this.framebufferSize);
        const greenBuffer = app.createTexture2D(this.framebufferSize * this.framebufferSize, this.framebufferSize);
        const blueBuffer = app.createTexture2D(this.framebufferSize * this.framebufferSize, this.framebufferSize);

        const framebuffer = app.createFramebuffer()
        .colorTarget(0, redBuffer)
        .colorTarget(1, greenBuffer)
        .colorTarget(2, blueBuffer);

        return framebuffer;
    },

    render(_RSMFrameBuffer) {
        if(_RSMFrameBuffer) {
            
            const rsmFlux = _RSMFrameBuffer.colorTextures[0];
            const rsmPositions = _RSMFrameBuffer.colorTextures[1];
            const rsmNormals = _RSMFrameBuffer.colorTextures[2];

            if (this.drawCall && this.framebuffer) {
               /* app.defaultDrawFramebuffer()
	            .defaultViewport()
	            .depthTest()
	            .depthFunc(PicoGL.LEQUAL)
                .noBlend()
                .clear();*/

               app.drawFramebuffer(this.framebuffer)
	            .viewport(0, 0, this.framebufferSize * this.framebufferSize, this.framebufferSize)
	            .depthTest()
	            .depthFunc(PicoGL.LEQUAL)
	            .noBlend()
	            .clear();

                //TODO:figure out the correct texture slice to render to
                /*
                for(var i = 0; i < this.size; i++)
                {
                    this.drawCall
                    //.uniform('u_texture_slice', i)
                    //.uniform('u_rsm_size', this.size)
                    .texture('u_rsm_flux', rsmFlux)
                    .texture('u_rsm_world_positions', rsmPositions)
                    .texture('u_rsm_world_normals', rsmNormals)
                    .uniform('u_world_from_local', mat4.create())
	    	        .uniform('u_view_from_world', camera.viewMatrix)
                    .uniform('u_projection_from_view', camera.projectionMatrix);

                    this.frameBuffer.colorTarget(0, frameBuffer.colorTextures[0], i);
                    this.frameBuffer.colorTarget(1, frameBuffer.colorTextures[1], i);
                    this.frameBuffer.colorTarget(2, frameBuffer.colorTextures[2], i);

                    this.drawCall.draw();
                }*/

                this.drawCall
                .texture('u_rsm_flux', rsmFlux)
                .texture('u_rsm_world_positions', rsmPositions)
                .texture('u_rsm_world_normals', rsmNormals)
                .uniform('u_rsm_size', this.size)
                .uniform('u_texture_size', this.framebufferSize)
                //.uniform('u_light_direction', directionalLight.direction)
                //.uniform('u_world_from_local', mat4.create())
	    	    //.uniform('u_view_from_world', camera.viewMatrix)
                //.uniform('u_projection_from_view', camera.projectionMatrix)
                .draw();
            }
        }
    }
};