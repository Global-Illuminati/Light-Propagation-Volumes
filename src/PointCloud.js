function RSMPointCloud(_size, _LPVGridSize) {
    this.size = _size || 512;
    this.framebufferSize = _LPVGridSize || 32;
    this.injectionFramebuffer = this.createFramebuffer(this.framebufferSize);
    this.geometryInjectionFramebuffer = this.createFramebuffer(this.framebufferSize);
    this.propagationFramebuffer = this.createFramebuffer(this.framebufferSize);
}

RSMPointCloud.prototype = {
    constructor: RSMPointCloud,

    //One point per pixel
    createInjectionPointCloud: function() {
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

    //One point per grid cell
    createPropagationPointCloud: function() {
        const positionData = new Float32Array(this.framebufferSize * this.framebufferSize * this.framebufferSize * 2);
        let positionIndex = 0;
        for(let x = 0; x < this.framebufferSize * this.framebufferSize; x++) {
            for(let y = 0; y < this.framebufferSize; y++) {
                positionData[positionIndex++] = x;
                positionData[positionIndex++] = y;
            }
        }

        const pointPositions = app.createVertexBuffer(PicoGL.FLOAT, 2, positionData);

        const pointArray = app.createVertexArray()
        .vertexAttributeBuffer(0, pointPositions);

        return pointArray;
    },

    createInjectionDrawCall: function(_shader) {
    this.injectionDrawCall = app.createDrawCall(_shader, this.createInjectionPointCloud(), PicoGL.POINTS);
        
        return this.injectionDrawCall;
    },

    createGeometryInjectDrawCall: function(_shader) {
        this.geometryInjectionDrawCall = app.createDrawCall(_shader, this.createInjectionPointCloud(), PicoGL.POINTS);

        return this.geometryInjectionDrawCall;
    },

    createPropagationDrawCall: function(_shader) {
        this.propagationDrawCall = app.createDrawCall(_shader, this.createPropagationPointCloud(), PicoGL.POINTS);

        return this.propagationDrawCall;
    },

    createFramebuffer: function(_size) {
        const redBuffer = app.createTexture2D(_size * _size, _size, {
            type: PicoGL.FLOAT,
		    internalFormat: PicoGL.RBGA32F,
        });
        const greenBuffer = app.createTexture2D(_size * _size, _size, {
            type: PicoGL.FLOAT,
		    internalFormat: PicoGL.RBGA32F,
        });
        const blueBuffer = app.createTexture2D(_size * _size, _size, {
            type: PicoGL.FLOAT,
		    internalFormat: PicoGL.RBGA32F,
        });

        const framebuffer = app.createFramebuffer()
        .colorTarget(0, redBuffer)
        .colorTarget(1, greenBuffer)
        .colorTarget(2, blueBuffer);

        return framebuffer;
    },

    lightInjection(_RSMFrameBuffer) {
        this.injectionFinished = false;

        if(_RSMFrameBuffer) {
            const rsmFlux = _RSMFrameBuffer.colorTextures[0];
            const rsmPositions = _RSMFrameBuffer.colorTextures[1];
            const rsmNormals = _RSMFrameBuffer.colorTextures[2];

            if (this.injectionDrawCall && this.injectionFramebuffer) {
               app.drawFramebuffer(this.injectionFramebuffer)
	            .viewport(0, 0, this.framebufferSize * this.framebufferSize, this.framebufferSize)
	            .depthTest()
	            .depthFunc(PicoGL.LEQUAL)
	            .noBlend()
	            .clear();

                this.injectionDrawCall
                .texture('u_rsm_flux', rsmFlux)
                .texture('u_rsm_world_positions', rsmPositions)
                .texture('u_rsm_world_normals', rsmNormals)
                .uniform('u_rsm_size', this.size)
                .uniform('u_texture_size', this.framebufferSize)
                .draw();

                this.injectionFinished = true;
            }
        }
    },

    geometryInjection(_RSMFrameBuffer, directionalLight) {
        this.geometryInjectionFinished = false;

        if(_RSMFrameBuffer) {
            const rsmFlux = _RSMFrameBuffer.colorTextures[0];
            const rsmPositions = _RSMFrameBuffer.colorTextures[1];
            const rsmNormals = _RSMFrameBuffer.colorTextures[2];
            const directionalLightDirection = directionalLight.direction;

            if (this.geometryInjectionDrawCall && this.geometryInjectionFramebuffer && this.injectionFinished) {
                app.drawFramebuffer(this.geometryInjectionFramebuffer)
                    .viewport(0, 0, this.framebufferSize * this.framebufferSize, this.framebufferSize)
                    .depthTest()
                    .depthFunc(PicoGL.LEQUAL)
                    .noBlend()
                    .clear();

                this.geometryInjectionDrawCall
                    .texture('u_rsm_flux', rsmFlux)
                    .texture('u_rsm_world_positions', rsmPositions)
                    .texture('u_rsm_world_normals', rsmNormals)
                    .uniform('u_rsm_size', this.size)
                    .uniform('u_texture_size', this.framebufferSize)
                    .uniform('u_light_direction', directionalLightDirection)
                    .draw();

                this.geometryInjectionFinished = true;
            }
        }
    },

    lightPropagation(_propagationIterations) {
        let LPVS = [ this.injectionFramebuffer, this.propagationFramebuffer ];
        const propagationIterations = _propagationIterations || 12;
        let lpvIndex;
        for(var i = 0; i < propagationIterations; i++) {
            //if even, return 0
            lpvIndex = i & 1;
            this.lightPropagationIteration(LPVS[lpvIndex], LPVS[lpvIndex ^ 1]);
        }
        this.accumulatedBuffer = LPVS[lpvIndex ^ 1];
    },

    lightPropagationIteration(currentLPV, accumulatedLPV) {
        // Check if injection has been done
        if (this.propagationDrawCall && currentLPV && accumulatedLPV && this.injectionFinished && this.geometryInjectionFinished) {
            app.drawFramebuffer(accumulatedLPV)
                .viewport(0, 0, this.framebufferSize * this.framebufferSize, this.framebufferSize)
                .noDepthTest()
                .depthFunc(PicoGL.LEQUAL)
                .noBlend()
                .clear();

            // Take injection cloud as input and propagate
            this.propagationDrawCall
                .texture('u_red_contribution', currentLPV.colorTextures[0])
                .texture('u_green_contribution', currentLPV.colorTextures[1])
                .texture('u_blue_contribution', currentLPV.colorTextures[2])
                .uniform('u_grid_size', this.framebufferSize)
                .draw();
        }
    }
};