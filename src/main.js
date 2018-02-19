'using strict';

////////////////////////////////////////////////////////////////////////////////

var stats;
var gui;

var settings = {
	target_fps: 60,
};

var sceneSettings = {
	ambientColor: new Float32Array([0.15, 0.15, 0.15, 1.0]),
};

////////////////////////////////////////////////////////////////////////////////

var app;

var gpuTimePanel;
var picoTimer;

var blitTextureDrawCall;

var sceneUniforms;

var shadowMapSize = 4096;
var shadowMapFramebuffer;

var camera;
var directionalLight;
var meshes = [];

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

	var options = options || {};

	options['minFilter'] = PicoGL.LINEAR_MIPMAP_NEAREST;
	options['magFilter'] = PicoGL.LINEAR;
	options['mipmaps'] = true;

	var texture = app.createTexture2D(1, 1, options);
	texture.data(new Uint8Array([200, 200, 200, 256]));

	var image = document.createElement('img');
	image.onload = function() {

		texture.resize(image.width, image.height);
		texture.data(image);

	};
	image.src = 'assets/' + imageName;
	return texture;

}

////////////////////////////////////////////////////////////////////////////////
// Initialization etc.

function init() {

	if (!checkWebGL2Compability()) {
		return;
	}

	var canvas = document.getElementById('canvas');
	app = PicoGL.createApp(canvas, { antialias: true });

	stats = new Stats();
	stats.showPanel(1); // (frame time)
	document.body.appendChild(stats.dom);

	gpuTimePanel = stats.addPanel(new Stats.Panel('MS (GPU)', '#ff8', '#221'));
	picoTimer = app.createTimer();

	gui = new dat.GUI();
	gui.add(settings, 'target_fps', 0, 120);

	//////////////////////////////////////
	// Basic GL state

	app.clearColor(0, 0, 0, 1);
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
	setupDirectionalLightShadowMapFramebuffer(shadowMapSize);

	setupSceneUniforms();

	var shaderPrograms = {};

	function makeShader(name, data) {
		var programData = data[name];
		var program = app.createProgram(programData.vertexSource, programData.fragmentSource);
		shaderPrograms[name] = program;
		return program;
	}

	var shaderLoader = new ShaderLoader('src/shaders/');
	shaderLoader.addShaderFile('common.glsl');
	shaderLoader.addShaderFile('scene_uniforms.glsl');
	shaderLoader.addShaderFile('mesh_attributes.glsl');
	shaderLoader.addShaderProgram('default', 'default.vert.glsl', 'default.frag.glsl');
	shaderLoader.addShaderProgram('textureBlit', 'screen_space.vert.glsl', 'texture_blit.frag.glsl');
	shaderLoader.addShaderProgram('shadowMapping', 'shadow_mapping.vert.glsl', 'shadow_mapping.frag.glsl');
	shaderLoader.load(function(data) {

		var textureBlitShader = makeShader('textureBlit', data);
		setupTextureBlitDrawCall(textureBlitShader);

		makeShader('default', data);
		makeShader('shadowMapping', data);

		var objLoader = new OBJLoader();
		var mtlLoader = new MTLLoader();

		objLoader.load('assets/sponza/sponza.obj_2xuv', function(objects) {
			mtlLoader.load("assets/sponza/sponza.mtl",function(materials){
				for (var i = 0; i < objects.length; ++i) {
					var material = undefined;
					for(var m = 0; m<materials.length;m++){
						if(materials[m].name === objects[i].material){
							material = materials[m];
						}
					}

					var vertexArray = createVertexArrayFromMeshInfo(objects[i]);

					var drawCall = app.createDrawCall(shaderPrograms['default'], vertexArray)
					.uniformBlock('SceneUniforms', sceneUniforms)
					.texture('u_diffuse_map',  loadTexture('sponza/' + material.properties.map_Kd))
					.texture('u_specular_map', loadTexture('sponza/' + material.properties.map_Ks))
					.texture('u_normal_map',   loadTexture('sponza/' + material.properties.map_norm));

					var shadowMappingDrawCall = app.createDrawCall(shaderPrograms['shadowMapping'], vertexArray);

					var mesh = {
						modelMatrix: mat4.create(),
						drawCall: drawCall,
						shadowMapDrawCall: shadowMappingDrawCall
					};
					meshes.push(mesh);
				}
			});
		});


	});

}

function setupTextureBlitDrawCall(shader) {

	var positions = app.createVertexBuffer(PicoGL.FLOAT, 3, new Float32Array([
		-1, -1, 0,
		+3, -1, 0,
		-1, +3, 0
	]));

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positions);

	blitTextureDrawCall = app.createDrawCall(shader, vertexArray);

}

function setupDirectionalLightShadowMapFramebuffer(size) {

	var colorBuffer = app.createTexture2D(size, size, {
		format: PicoGL.RED,
		internalFormat: PicoGL.R8,
		minFilter: PicoGL.NEAREST,
		magFilter: PicoGL.NEAREST
	});

	var depthBuffer = app.createTexture2D(size, size, {
		format: PicoGL.DEPTH_COMPONENT
	});

	shadowMapFramebuffer = app.createFramebuffer()
	.colorTarget(0, colorBuffer)
	.depthTarget(depthBuffer);

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
	var texCoords = app.createVertexBuffer(PicoGL.FLOAT, 2, meshInfo.uvs);

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positions)
	.vertexAttributeBuffer(1, normals)
	.vertexAttributeBuffer(2, texCoords);
	return vertexArray;
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
		camera.update();

		// Render shadow map (for the directional light) (if needed!)
		renderShadowMap();

		var dirLightViewDirection = directionalLight.viewSpaceDirection(camera);
		var lightViewProjection = directionalLight.getLightViewProjectionMatrix();
		var shadowMap = shadowMapFramebuffer.depthTexture;

		// Setup for rendering
		app.defaultDrawFramebuffer()
		.defaultViewport()
		.depthTest()
		.noBlend()
		.clear();

		// Render scene
		for (var i = 0, len = meshes.length; i < len; ++i) {

			var mesh = meshes[i];

			mesh.drawCall
			.uniform('u_world_from_local', mesh.modelMatrix)
			.uniform('u_view_from_world', camera.viewMatrix)
			.uniform('u_projection_from_view', camera.projectionMatrix)
			.uniform('u_dir_light_color', directionalLight.color)
			.uniform('u_dir_light_view_direction', dirLightViewDirection)
			.uniform('u_light_projection_from_world', lightViewProjection)
			.texture('u_shadow_map', shadowMap)
			.draw();

		}

		//renderTextureToScreen(shadowMap);

		var renderDelta = new Date().getTime() - startStamp;
		setTimeout( function() {
			requestAnimationFrame(render);
		}, 1000 / settings.target_fps - renderDelta-1000/120);

	}
	picoTimer.end();
	stats.end();

	if (picoTimer.ready()) {
		gpuTimePanel.update(picoTimer.gpuTime, 35);
	}

/*
	requestAnimationFrame(render);
*/
}

function shadowMapNeedsRendering() {

	var lastDirection = shadowMapNeedsRendering.lastDirection || vec3.create();
	var lastMeshCount = shadowMapNeedsRendering.lastMeshCount || 0;

	if (vec3.equals(lastDirection, directionalLight.direction) && lastMeshCount === meshes.length) {

		return false;

	} else {

		shadowMapNeedsRendering.lastDirection = vec3.copy(lastDirection, directionalLight.direction);
		shadowMapNeedsRendering.lastMeshCount = meshes.length;

		return true;

	}


}

function renderShadowMap() {

	if (!directionalLight) return;
	if (!shadowMapNeedsRendering()) return;

	var lightViewProjection = directionalLight.getLightViewProjectionMatrix();

	app.drawFramebuffer(shadowMapFramebuffer)
	.viewport(0, 0, shadowMapSize, shadowMapSize)
	.depthTest()
	.noBlend()
	.clear();

	for (var i = 0, len = meshes.length; i < len; ++i) {

		var mesh = meshes[i];

		mesh.shadowMapDrawCall
		.uniform('u_world_from_local', mesh.modelMatrix)
		.uniform('u_light_projection_from_world', lightViewProjection)
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
