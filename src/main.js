'using strict';

////////////////////////////////////////////////////////////////////////////////

var stats;
var gui;

var settings = {
	target_fps: 60,
	environment_brightness: 1.5,

	rotate_light:false,

	indirect_light_attenuation: 1.5,
	render_lpv_debug_view: false,
	render_direct_light: true,
	render_indirect_light: false
};

var sceneSettings = {
	ambientColor: new Float32Array([0.15, 0.15, 0.15, 1.0]),
};

////////////////////////////////////////////////////////////////////////////////

var app;

var gpuTimePanel;
var picoTimer;

var defaultShader;
var shadowMapShader;

var pointCloud;

var blitTextureDrawCall;
var environmentDrawCall;

var sceneUniforms;

var shadowMapSize = 4096;
var shadowMapFramebuffer;

var shadowMapSmallSize = 512;
var shadowMapSmallFramebuffer;

var initLPV = false;
var lpvGridSize = 64;
var propagationIterations = lpvGridSize / 16;

var camera;
var directionalLight;
var meshes = [];
var texturesLoaded = 0;

var probeDrawCall;

window.addEventListener('DOMContentLoaded', function () {

	init();
	resize();

	window.addEventListener('resize', resize, false);
	requestAnimationFrame(render);

}, false);

////////////////////////////////////////////////////////////////////////////////
// Utility

function checkWebGL2Compability() {

	var c = document.createElement('canvas');
	var webgl2 = c.getContext('webgl2');
	if (!webgl2) {
		var message = document.createElement('p');
		message.id = 'no-webgl2-error';
		message.innerHTML = 'WebGL 2.0 doesn\'t seem to be supported in this browser and is required for this demo! ' +
			'It should work on most modern desktop browsers though.';
		canvas.parentNode.replaceChild(message, document.getElementById('canvas'));
		return false;
	}
	return true;

}

function loadTexture(imageName, options) {

	if (!options) {

		var options = {};
		options['minFilter'] = PicoGL.LINEAR_MIPMAP_NEAREST;
		options['magFilter'] = PicoGL.LINEAR;
		options['mipmaps'] = true;

	}

	var texture = app.createTexture2D(1, 1, options);
	texture.data(new Uint8Array([200, 200, 200, 256]));

	var image = document.createElement('img');
	image.onload = function() {

		texture.resize(image.width, image.height);
		texture.data(image);
		texturesLoaded++;
	};
	image.src = 'assets/' + imageName;
	return texture;

}

function makeShader(name, shaderLoaderData) {

	var programData = shaderLoaderData[name];
	var program = app.createProgram(programData.vertexSource, programData.fragmentSource);
	return program;

}

function loadObject(directory, objFilename, mtlFilename, modelMatrix) {

	var objLoader = new OBJLoader();
	var mtlLoader = new MTLLoader();

	var path = 'assets/' + directory;

	objLoader.load(path + objFilename, function(objects) {
		mtlLoader.load(path + mtlFilename, function(materials) {
			objects.forEach(function(object) {

				var material = materials[object.material];
				var diffuseMap  = (material.properties.map_Kd)   ? directory + material.properties.map_Kd   : 'default_diffuse.png';
				var specularMap = (material.properties.map_Ks)   ? directory + material.properties.map_Ks   : 'default_specular.jpg';
				var normalMap   = (material.properties.map_norm) ? directory + material.properties.map_norm : 'default_normal.jpg';

				var vertexArray = createVertexArrayFromMeshInfo(object);

				var drawCall = app.createDrawCall(defaultShader, vertexArray)
				.uniformBlock('SceneUniforms', sceneUniforms)
				.texture('u_diffuse_map', loadTexture(diffuseMap))
				.texture('u_specular_map', loadTexture(specularMap))
				.texture('u_normal_map', loadTexture(normalMap));

				var shadowMappingDrawCall = app.createDrawCall(shadowMapShader, vertexArray)
				.texture('u_diffuse_map', loadTexture(diffuseMap));

				meshes.push({
					modelMatrix: modelMatrix || mat4.create(),
					drawCall: drawCall,
					shadowMapDrawCall: shadowMappingDrawCall
				});

			});
		});
	});
	renderShadowMap();
}

////////////////////////////////////////////////////////////////////////////////
// Initialization etc.

function init() {

	if (!checkWebGL2Compability()) {
		return;
	}

	var canvas = document.getElementById('canvas');
	app = PicoGL.createApp(canvas, { antialias: true });
	app.floatRenderTargets();

	stats = new Stats();
	stats.showPanel(1); // (frame time)
	document.body.appendChild(stats.dom);

	gpuTimePanel = stats.addPanel(new Stats.Panel('MS (GPU)', '#ff8', '#221'));
	picoTimer = app.createTimer();

	gui = new dat.GUI();
	gui.add(settings, 'target_fps', 0, 120);
	gui.add(settings, 'environment_brightness', 0.0, 2.0);
	gui.add(settings, 'rotate_light').name('Rotate light');
	gui.add(settings, 'indirect_light_attenuation').name('Indirect light attenuation');
	gui.add(settings, 'render_lpv_debug_view').name('Render LPV cells');
	gui.add(settings, 'render_direct_light').name('Direct light');
	gui.add(settings, 'render_indirect_light').name('Indirect light');

	//////////////////////////////////////
	// Basic GL state

	app.clearColor(0, 0, 0, 0);
	app.cullBackfaces();
	app.noBlend();

	//////////////////////////////////////
	// Camera stuff

	var cameraPos = vec3.fromValues(-15, 3, 0);
	var cameraRot = quat.fromEuler(quat.create(), 15, -90, 0);
	camera = new Camera(cameraPos, cameraRot);

	//////////////////////////////////////
	// Scene setup

	directionalLight = new DirectionalLight();
	shadowMapFramebuffer = setupDirectionalLightShadowMapFramebuffer(shadowMapSize);
	shadowMapSmallFramebuffer = setupDirectionalLightShadowMapFramebuffer(shadowMapSmallSize);

	setupSceneUniforms();

	pointCloud = new RSMPointCloud(shadowMapSmallSize, lpvGridSize);

	var shaderLoader = new ShaderLoader('src/shaders/');
	shaderLoader.addShaderFile('common.glsl');
	shaderLoader.addShaderFile('scene_uniforms.glsl');
	shaderLoader.addShaderFile('mesh_attributes.glsl');
	shaderLoader.addShaderFile('lpv_common.glsl');
	shaderLoader.addShaderProgram('unlit', 'unlit.vert.glsl', 'unlit.frag.glsl');
	shaderLoader.addShaderProgram('default', 'default.vert.glsl', 'default.frag.glsl');
	shaderLoader.addShaderProgram('environment', 'environment.vert.glsl', 'environment.frag.glsl');
	shaderLoader.addShaderProgram('textureBlit', 'screen_space.vert.glsl', 'texture_blit.frag.glsl');
	shaderLoader.addShaderProgram('shadowMapping', 'lpv/reflective_shadow_map.vert.glsl', 'lpv/reflective_shadow_map.frag.glsl');
	shaderLoader.addShaderProgram('lightInjection', 'lpv/light_injection.vert.glsl', 'lpv/light_injection.frag.glsl');
	shaderLoader.addShaderProgram('lightPropagation', 'lpv/light_propagation.vert.glsl', 'lpv/light_propagation.frag.glsl');
	shaderLoader.addShaderProgram('lpvDebug', 'lpv/lpv_debug.vert.glsl', 'lpv/lpv_debug.frag.glsl');
	shaderLoader.load(function(data) {

		var fullscreenVertexArray = createFullscreenVertexArray();

		var textureBlitShader = makeShader('textureBlit', data);
		blitTextureDrawCall = app.createDrawCall(textureBlitShader, fullscreenVertexArray);

		var lightInjectShader = makeShader('lightInjection', data);
		var lightPropagationShader = makeShader('lightPropagation', data);
		pointCloud.createInjectionDrawCall(lightInjectShader);
		pointCloud.createPropagationDrawCall(lightPropagationShader);

		var environmentShader = makeShader('environment', data);
		environmentDrawCall = app.createDrawCall(environmentShader, fullscreenVertexArray)
		.texture('u_environment_map', loadTexture('environments/ocean.jpg', {}));

		var lpvDebugShader = makeShader('lpvDebug', data);
		var probeVertexArray = createSphereVertexArray(0.08, 8, 8);
		setupProbeDrawCall(probeVertexArray, lpvDebugShader);

		defaultShader = makeShader('default', data);
		shadowMapShader = makeShader('shadowMapping', data);
		loadObject('sponza/', 'sponza.obj', 'sponza.mtl');
		{
			let m = mat4.create();
			let r = quat.fromEuler(quat.create(), 0, 45, 0);
			let t = vec3.fromValues(-5, 1, 2.5);
			let s = vec3.fromValues(0.06, 0.06, 0.06);
			mat4.fromRotationTranslationScale(m, r, t, s);
			loadObject('teapot/', 'teapot.obj', 'default.mtl', m);
		}

	});

}

function createFullscreenVertexArray() {

	var positions = app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array([
		-1, -1, 0,
		+3, -1, 0,
		-1, +3, 0
	]));

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positions);

	return vertexArray;

}

function createSphereVertexArray(radius, rings, sectors) {

	var positions = [];

	var R = 1.0 / (rings - 1);
	var S = 1.0 / (sectors - 1);

	var PI = Math.PI;
	var TWO_PI = 2.0 * PI;

	for (var r = 0; r < rings; ++r) {
		for (var s = 0; s < sectors; ++s) {

			var y = Math.sin(-(PI / 2.0) + PI * r * R);
			var x = Math.cos(TWO_PI * s * S) * Math.sin(PI * r * R);
			var z = Math.sin(TWO_PI * s * S) * Math.sin(PI * r * R);

			positions.push(x * radius);
			positions.push(y * radius);
			positions.push(z * radius);

		}
	}

	var indices = [];

	for (var r = 0; r < rings - 1; ++r) {
		for (var s = 0; s < sectors - 1; ++s) {

			var i0 = r * sectors + s;
			var i1 = r * sectors + (s + 1);
			var i2 = (r + 1) * sectors + (s + 1);
			var i3 = (r + 1) * sectors + s;

			indices.push(i2);
			indices.push(i1);
			indices.push(i0);

			indices.push(i3);
			indices.push(i2);
			indices.push(i0);

		}
	}

	var positionBuffer = app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array(positions));
	var indexBuffer = app.createIndexBuffer(PicoGL.UNSIGNED_SHORT, 3, new Uint16Array(indices));

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positionBuffer)
	.indexBuffer(indexBuffer);

	return vertexArray;

}

function setupDirectionalLightShadowMapFramebuffer(size) {
	var colorBuffer = app.createTexture2D(size, size, {
		type: PicoGL.FLOAT,
		internalFormat: PicoGL.RBGA32F,
		minFilter: PicoGL.NEAREST,
		magFilter: PicoGL.NEAREST,
		generateMipmaps: true
	});
	var positionBuffer = app.createTexture2D(size, size , {
		type: PicoGL.FLOAT,
		internalFormat: PicoGL.RBGA32F,
		minFilter: PicoGL.NEAREST,
		magFilter: PicoGL.NEAREST,
		generateMipmaps: true
	});
	var normalBuffer = app.createTexture2D(size, size, {
		type: PicoGL.FLOAT,
		internalFormat: PicoGL.RBGA32F,
		minFilter: PicoGL.NEAREST,
		magFilter: PicoGL.NEAREST,
		generateMipmaps: true
	});
	var depthBuffer = app.createTexture2D(size, size, {
		type: PicoGL.FLOAT,
		internalFormat: PicoGL.RBGA32F,
		format: PicoGL.DEPTH_COMPONENT
	});
	var framebuffer = app.createFramebuffer()
	.colorTarget(0, colorBuffer)
	.colorTarget(1, positionBuffer)
	.colorTarget(2, normalBuffer)
	.depthTarget(depthBuffer);

	return framebuffer;
}

function setupSceneUniforms() {

	//
	// TODO: Fix all this! I got some weird results when I tried all this before but it should work...
	//

	sceneUniforms = app.createUniformBuffer([
		PicoGL.FLOAT_VEC4 /* 0 - ambient color */   //,
		//PicoGL.FLOAT_VEC4 /* 1 - directional light color */,
		//PicoGL.FLOAT_VEC4 /* 2 - directional light direction */,
		//PicoGL.FLOAT_MAT4 /* 3 - view from world matrix */,
		//PicoGL.FLOAT_MAT4 /* 4 - projection from view matrix */
	])
	.set(0, sceneSettings.ambientColor)
	//.set(1, directionalLight.color)
	//.set(2, directionalLight.direction)
	//.set(3, camera.viewMatrix)
	//.set(4, camera.projectionMatrix)
	.update();

/*
	camera.onViewMatrixChange = function(newValue) {
		sceneUniforms.set(3, newValue).update();
	};

	camera.onProjectionMatrixChange = function(newValue) {
		sceneUniforms.set(4, newValue).update();
	};
*/

}

function createVertexArrayFromMeshInfo(meshInfo) {

	var positions = app.createVertexBuffer(PicoGL.FLOAT, 3, meshInfo.positions);
	var normals   = app.createVertexBuffer(PicoGL.FLOAT, 3, meshInfo.normals);
	var tangents  = app.createVertexBuffer(PicoGL.FLOAT, 4, meshInfo.tangents);
	var texCoords = app.createVertexBuffer(PicoGL.FLOAT, 2, meshInfo.uvs);

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positions)
	.vertexAttributeBuffer(1, normals)
	.vertexAttributeBuffer(2, texCoords)
	.vertexAttributeBuffer(3, tangents);

	return vertexArray;

}

function setupProbeDrawCall(vertexArray, shader) {

	//
	// Place probes
	//

	var probeLocations = [];
	var probeIndices   = [];

	var gridSize = lpvGridSize;
	var origin = vec3.fromValues(0, 0, 0);
	var step   = vec3.fromValues(1, 1, 1);

	var halfGridSize = vec3.fromValues(gridSize / 2, gridSize / 2, gridSize / 2);
	var halfSize = vec3.mul(vec3.create(), step, halfGridSize);

	var bottomLeft = vec3.sub(vec3.create(), origin, halfSize);

	var diff = vec3.create();

	for (var z = 0; z < gridSize; ++z) {
		for (var y = 0; y < gridSize; ++y) {
			for (var x = 0; x < gridSize; ++x) {

				vec3.mul(diff, step, vec3.fromValues(x, y, z));

				var pos = vec3.create();
				vec3.add(pos, bottomLeft, diff);
				vec3.add(pos, pos, vec3.fromValues(0.5, 0.5, 0.5));

				probeLocations.push(pos[0]);
				probeLocations.push(pos[1]);
				probeLocations.push(pos[2]);

				probeIndices.push(x);
				probeIndices.push(y);
				probeIndices.push(z);

			}
		}
	}

	//
	// Pack into instance buffer
	//

	// We need at least one (x,y,z) pair to render any probes
	if (probeLocations.length <= 3) {
		return;
	}

	if (probeLocations.length % 3 !== 0) {
		console.error('Probe locations invalid! Number of coordinates is not divisible by 3.');
		return;
	}

	// Set up for instanced drawing at the probe locations
	var translations = app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array(probeLocations));
	var indices      = app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array(probeIndices));
	vertexArray.instanceAttributeBuffer(10, translations);
	vertexArray.instanceAttributeBuffer(11, indices);

	probeDrawCall = app.createDrawCall(shader, vertexArray);

}

////////////////////////////////////////////////////////////////////////////////

function resize() {

	var w = window.innerWidth;
	var h = window.innerHeight;

	app.resize(w, h);
	camera.resize(w, h);

}

////////////////////////////////////////////////////////////////////////////////
// Rendering

function render() {
	var startStamp = new Date().getTime();

	stats.begin();
	picoTimer.start();
	{
		if (settings["rotate_light"]) {
            // Rotate light
            vec3.rotateY(directionalLight.direction, directionalLight.direction, vec3.fromValues(0.0,0.0,0.0), 0.01);
        }

		camera.update();

		renderShadowMap();
		// Only refresh LPV when shadow map has been updated
		if(initLPV) {
			console.time('LPV');
			pointCloud.lightInjection(shadowMapSmallFramebuffer);
			pointCloud.lightPropagation(propagationIterations);
			initLPV = false;
			console.timeEnd('LPV');
		}
		renderScene(pointCloud.propagationFramebuffer);

		var viewProjection = mat4.mul(mat4.create(), camera.projectionMatrix, camera.viewMatrix);

		if (settings.render_lpv_debug_view) {
			renderLpvCells(viewProjection);
		}

		var inverseViewProjection = mat4.invert(mat4.create(), viewProjection);
		renderEnvironment(inverseViewProjection);

		// Call this to get a debug render of the passed in texture
		//renderTextureToScreen(pointCloud.injectionFramebuffer.colorTextures[0]);
		//renderTextureToScreen(pointCloud.propagationFramebuffer.colorTextures[0]);
		//renderTextureToScreen(shadowMapSmallFramebuffer.colorTextures[1]);

	}
	picoTimer.end();
	stats.end();

	if (picoTimer.ready()) {
		gpuTimePanel.update(picoTimer.gpuTime, 35);
	}

	//requestAnimationFrame(render);

	var renderDelta = new Date().getTime() - startStamp;
	setTimeout( function() {
		requestAnimationFrame(render);
	}, 1000 / settings.target_fps - renderDelta-1000/120);

}

function shadowMapNeedsRendering() {

	var lastDirection = shadowMapNeedsRendering.lastDirection || vec3.create();
	var lastMeshCount = shadowMapNeedsRendering.lastMeshCount || 0;
	var lastTexturesLoaded = shadowMapNeedsRendering.lastTexturesLoaded || 0;

	if (vec3.equals(lastDirection, directionalLight.direction) && lastMeshCount === meshes.length
		&& lastTexturesLoaded == texturesLoaded) {

		return false;

	} else {

		shadowMapNeedsRendering.lastDirection = vec3.copy(lastDirection, directionalLight.direction);
		shadowMapNeedsRendering.lastMeshCount = meshes.length;
		shadowMapNeedsRendering.lastTexturesLoaded = texturesLoaded;

		return true;

	}
}

function renderShadowMap() {
//TODO: only render when needed to
if (!shadowMapNeedsRendering()) return;

	if (!directionalLight) return;
	var lightViewProjection = directionalLight.getLightViewProjectionMatrix();
	var lightViewDirection = directionalLight.viewSpaceDirection(camera);
	var lightColor = directionalLight.color;

	app.drawFramebuffer(shadowMapSmallFramebuffer)
	.viewport(0, 0, shadowMapSmallSize, shadowMapSmallSize)
	.depthTest()
	.depthFunc(PicoGL.LEQUAL)
	.noBlend()
	.clear();

	for (var i = 0, len = meshes.length; i < len; ++i) {

		var mesh = meshes[i];

		mesh.shadowMapDrawCall
		.uniform('u_world_from_local', mesh.modelMatrix)
		.uniform('u_light_projection_from_world', lightViewProjection)
		.uniform('u_light_direction', lightViewDirection)
		.uniform('u_light_color', lightColor)
		.draw();

	}


	var lightViewProjection = directionalLight.getLightViewProjectionMatrix();
	var lightViewDirection = directionalLight.viewSpaceDirection(camera);
	var lightColor = directionalLight.color;

	app.drawFramebuffer(shadowMapFramebuffer)
	.viewport(0, 0, shadowMapSize, shadowMapSize)
	.depthTest()
	.depthFunc(PicoGL.LEQUAL)
	.noBlend()
	.clear();

	for (var i = 0, len = meshes.length; i < len; ++i) {

		var mesh = meshes[i];

		mesh.shadowMapDrawCall
		.uniform('u_world_from_local', mesh.modelMatrix)
		.uniform('u_light_projection_from_world', lightViewProjection)
		.uniform('u_light_direction', lightViewDirection)
		.uniform('u_light_color', lightColor)
		.draw();

	}
	initLPV = true;
}

function renderScene(framebuffer) {

	var dirLightViewDirection = directionalLight.viewSpaceDirection(camera);
	var lightViewProjection = directionalLight.getLightViewProjectionMatrix();
	var shadowMap = shadowMapFramebuffer.depthTexture;

	app.defaultDrawFramebuffer()
	.defaultViewport()
	.depthTest()
	.depthFunc(PicoGL.LEQUAL)
	.noBlend();
	//.clear();

	for (var i = 0, len = meshes.length; i < len; ++i) {
		var mesh = meshes[i];
		mesh.drawCall
		.uniform('u_world_from_local', mesh.modelMatrix)
		.uniform('u_view_from_world', camera.viewMatrix)
		.uniform('u_projection_from_view', camera.projectionMatrix)
		.uniform('u_dir_light_color', directionalLight.color)
		.uniform('u_dir_light_view_direction', dirLightViewDirection)
		.uniform('u_light_projection_from_world', lightViewProjection)
		.uniform('u_texture_size', pointCloud.framebufferSize)
		.uniform('u_render_direct_light', settings.render_direct_light)
		.uniform('u_render_indirect_light', settings.render_indirect_light)
		.uniform('u_indirect_light_attenuation', settings.indirect_light_attenuation)
		.texture('u_shadow_map', shadowMap)
		.texture('u_red_indirect_light', framebuffer.colorTextures[0])
		.texture('u_green_indirect_light', framebuffer.colorTextures[1])
		.texture('u_blue_indirect_light', framebuffer.colorTextures[2])
		.draw();

	}

}

function renderLpvCells(viewProjection) {

	if (probeDrawCall) {

		app.defaultDrawFramebuffer()
		.defaultViewport()
		.depthTest()
		.depthFunc(PicoGL.LEQUAL)
		.noBlend();

		// Replace with the propagated for a view of it
		var lpv = pointCloud.injectionFramebuffer;

		probeDrawCall
		.texture('u_lpv_red', lpv.colorTextures[0])
		.texture('u_lpv_green', lpv.colorTextures[1])
		.texture('u_lpv_blue', lpv.colorTextures[2])
		.uniform('u_lpv_size', shadowMapSmallSize)
		.uniform('u_projection_from_world', viewProjection)
		.draw();

	}

}

function renderEnvironment(inverseViewProjection) {

	if (environmentDrawCall) {

		app.defaultDrawFramebuffer()
		.defaultViewport()
		.depthTest()
		.depthFunc(PicoGL.EQUAL)
		.noBlend();

		environmentDrawCall
		.uniform('u_camera_position', camera.position)
		.uniform('u_world_from_projection', inverseViewProjection)
		.uniform('u_environment_brightness', settings.environment_brightness)
		.draw();

	}

}

function renderTextureToScreen(texture) {

	//
	// NOTE:
	//
	//   This function can be really helpful for debugging!
	//   Just call this whenever and you get the texture on
	//   the screen (just make sure nothing is drawn on top)
	//

	if (!blitTextureDrawCall) {
		return;
	}

	app.defaultDrawFramebuffer()
	.defaultViewport()
	.noDepthTest()
	.noBlend();

	blitTextureDrawCall
	.texture('u_texture', texture)
	.draw();

}

////////////////////////////////////////////////////////////////////////////////