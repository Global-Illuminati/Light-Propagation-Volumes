function RSMPointCloud(_size) {
    this.size = 4096 || _size;
    this.frameBuffer = this.createFrameBuffer();
}

RSMPointCloud.prototype = {
    constructor: RSMPointCloud,

    createPointCloud: function() {
        var positionData = new Float32Array(this.size * this.size * 2);

        var positionIndex = 0;
        for(var x = 0; x < this.size; x++) {
            for(var y = 0; y < this.size; y++) {
                positionData[positionIndex++] = x;
                positionData[positionIndex++] = y;
            }
        }

        var pointPositions = app.createVertexBuffer(PicoGL.FLOAT, 2, positionData);

        var pointArray = app.createVertexArray()
        .vertexAttributeBuffer(0, pointPositions);

        return pointArray;
    },

    createDrawCall: function(_shader) {
        this.drawCall = app.createDrawCall(_shader, this.createPointCloud(), PicoGL.POINTS);
        
        return this.drawCall;
    },

    createFrameBuffer: function() {
        this.redBuffer = app.createTexture3D(this.size, this.size, this.size);
        this.greenBuffer = app.createTexture3D(this.size, this.size, this.size);
        this.blueBuffer = app.createTexture3D(this.size, this.size, this.size);

        var frameBuffer = app.createFramebuffer()
        .colorTarget(0, this.redBuffer)
        .colorTarget(1, this.greenBuffer)
        .colorTarget(2, this.blueBuffer);

        return frameBuffer;
    },

    render(_RSMFrameBuffer) {
        if(_RSMFrameBuffer) {
            
            var rsmFlux = _RSMFrameBuffer.colorTextures[0];
            var rsmPositions = _RSMFrameBuffer.colorTextures[1];
            var rsmNormals = _RSMFrameBuffer.colorTextures[2];
            if(this.drawCall && this.frameBuffer) {

                app.defaultDrawFramebuffer()
	            .defaultViewport()
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
                .uniform('u_world_from_local', mat4.create())
	    	    .uniform('u_view_from_world', camera.viewMatrix)
                .uniform('u_projection_from_view', camera.projectionMatrix);
            }
        }
    }
}