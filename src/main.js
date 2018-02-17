'using strict';

var stats;
var gui;

var settings = {
	target_fps: 60,
};

var sceneSettings = {
	ambientColor: new Float32Array([0.15, 0.15, 0.15, 1.0]),
};

var app;
var fullyInitialized = false;

var sceneUniforms;

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
	app = PicoGL.createApp(canvas);

	stats = new Stats();
	stats.showPanel(1); // (frame time)
	document.body.appendChild(stats.dom);

	gui = new dat.GUI();
	gui.add(settings, 'target_fps', 0, 120);

	//////////////////////////////////////
	// Basic GL state

	app.clearColor(1, 1, 1, 1);
	app.cullBackfaces();
	app.noBlend();

	//////////////////////////////////////
	// Camera stuff

	var cameraPos = vec3.fromValues(0, 2, 4);
	var cameraRot = quat.fromEuler(quat.create(), -30, 0, 0);
	camera = new Camera(cameraPos, cameraRot);

	//////////////////////////////////////
	// Scene setup

	directionalLight = new DirectionalLight();

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

	var shaderPrograms = {};

	function makeShader(name, data) {
		var programData = data[name];
		var program = app.createProgram(programData.vertexSource, programData.fragmentSource);
		shaderPrograms[name] = program;
	}

	var shaderLoader = new ShaderLoader('src/shaders/');
	shaderLoader.addShaderFile('common.glsl');
	shaderLoader.addShaderFile('scene_uniforms.glsl');
	shaderLoader.addShaderProgram('test', 'test.vert.glsl', 'test.frag.glsl');
	shaderLoader.addShaderProgram('default', 'default.vert.glsl', 'default.frag.glsl');
	shaderLoader.load(function(data) {

		makeShader('default', data);
		makeShader('test', data);

		// TODO: Needed?
		//THREE.Loader.Handlers.add( /\.dds$/i, new THREE.DDSLoader());
/*
		var mtlLoader = new MTLLoader();
		mtlLoader.setPath('assets/sponza/');
		mtlLoader.load('sponza.mtl', function(materials) {
			materials.preload();

			var objLoader = new OBJLoader();
			objLoader.setMaterials(materials);

			objLoader.load('assets/sponza/sponza.obj', function(objects) {
				for (var i = 0; i < objects.length; ++i) {
					// TODO TODO TODO TODO TODO TODO TODO
					meshes.push(objects[i]);
					// TODO TODO TODO TODO TODO TODO TODO
				}
			});
		});
*/

		var boxVertexArray = createExampleVertexArray();

		var boxDrawCall = app.createDrawCall(shaderPrograms['default'], boxVertexArray)
		.uniformBlock('SceneUniforms', sceneUniforms)
		.texture('u_diffuse_map', loadTexture('test/gravel_col.jpg'))
		.texture('u_specular_map', loadTexture('test/gravel_spec.jpg'))
		.texture('u_normal_map', loadTexture('test/gravel_norm.jpg'));

		var mesh = {
			modelMatrix: mat4.create(),
			drawCall: boxDrawCall
		};

		meshes.push(mesh);
		fullyInitialized = true;

	});

}

function createExampleVertexArray() {

	var box = createBox();

	var positions = app.createVertexBuffer(PicoGL.FLOAT, 3, box.positions);
	var normals   = app.createVertexBuffer(PicoGL.FLOAT, 3, box.normals);
	var texCoords = app.createVertexBuffer(PicoGL.FLOAT, 2, box.uvs);

	var vertexArray = app.createVertexArray()
	.vertexAttributeBuffer(0, positions)
	.vertexAttributeBuffer(1, normals)
	.vertexAttributeBuffer(2, texCoords);

	return vertexArray;

}

//
// TODO: Remove me! From PicoGL examples:
// https://github.com/tsherif/picogl.js/blob/master/examples/utils/utils.js
//
function createBox(options) {
	options = options || {};

	var dimensions = options.dimensions || [1, 1, 1];
	var position = options.position || [-dimensions[0] / 2, -dimensions[1] / 2, -dimensions[2] / 2];
	var x = position[0];
	var y = position[1];
	var z = position[2];
	var width = dimensions[0];
	var height = dimensions[1];
	var depth = dimensions[2];

	var fbl = {x: x,         y: y,          z: z + depth};
	var fbr = {x: x + width, y: y,          z: z + depth};
	var ftl = {x: x,         y: y + height, z: z + depth};
	var ftr = {x: x + width, y: y + height, z: z + depth};
	var bbl = {x: x,         y: y,          z: z };
	var bbr = {x: x + width, y: y,          z: z };
	var btl = {x: x,         y: y + height, z: z };
	var btr = {x: x + width, y: y + height, z: z };

	var positions = new Float32Array([
			//front
			fbl.x, fbl.y, fbl.z,
			fbr.x, fbr.y, fbr.z,
			ftl.x, ftl.y, ftl.z,
			ftl.x, ftl.y, ftl.z,
			fbr.x, fbr.y, fbr.z,
			ftr.x, ftr.y, ftr.z,

			//right
			fbr.x, fbr.y, fbr.z,
			bbr.x, bbr.y, bbr.z,
			ftr.x, ftr.y, ftr.z,
			ftr.x, ftr.y, ftr.z,
			bbr.x, bbr.y, bbr.z,
			btr.x, btr.y, btr.z,

			//back
			fbr.x, bbr.y, bbr.z,
			bbl.x, bbl.y, bbl.z,
			btr.x, btr.y, btr.z,
			btr.x, btr.y, btr.z,
			bbl.x, bbl.y, bbl.z,
			btl.x, btl.y, btl.z,

			//left
			bbl.x, bbl.y, bbl.z,
			fbl.x, fbl.y, fbl.z,
			btl.x, btl.y, btl.z,
			btl.x, btl.y, btl.z,
			fbl.x, fbl.y, fbl.z,
			ftl.x, ftl.y, ftl.z,

			//top
			ftl.x, ftl.y, ftl.z,
			ftr.x, ftr.y, ftr.z,
			btl.x, btl.y, btl.z,
			btl.x, btl.y, btl.z,
			ftr.x, ftr.y, ftr.z,
			btr.x, btr.y, btr.z,

			//bottom
			bbl.x, bbl.y, bbl.z,
			bbr.x, bbr.y, bbr.z,
			fbl.x, fbl.y, fbl.z,
			fbl.x, fbl.y, fbl.z,
			bbr.x, bbr.y, bbr.z,
			fbr.x, fbr.y, fbr.z
	]);

	var uvs = new Float32Array([
			//front
			0, 0,
			1, 0,
			0, 1,
			0, 1,
			1, 0,
			1, 1,

			//right
			0, 0,
			1, 0,
			0, 1,
			0, 1,
			1, 0,
			1, 1,

			//back
			0, 0,
			1, 0,
			0, 1,
			0, 1,
			1, 0,
			1, 1,

			//left
			0, 0,
			1, 0,
			0, 1,
			0, 1,
			1, 0,
			1, 1,

			//top
			0, 0,
			1, 0,
			0, 1,
			0, 1,
			1, 0,
			1, 1,

			//bottom
			0, 0,
			1, 0,
			0, 1,
			0, 1,
			1, 0,
			1, 1
	]);

	var normals = new Float32Array([
			// front
			0, 0, 1,
			0, 0, 1,
			0, 0, 1,
			0, 0, 1,
			0, 0, 1,
			0, 0, 1,

			// right
			1, 0, 0,
			1, 0, 0,
			1, 0, 0,
			1, 0, 0,
			1, 0, 0,
			1, 0, 0,

			// back
			0, 0, -1,
			0, 0, -1,
			0, 0, -1,
			0, 0, -1,
			0, 0, -1,
			0, 0, -1,

			// left
			-1, 0, 0,
			-1, 0, 0,
			-1, 0, 0,
			-1, 0, 0,
			-1, 0, 0,
			-1, 0, 0,

			// top
			0, 1, 0,
			0, 1, 0,
			0, 1, 0,
			0, 1, 0,
			0, 1, 0,
			0, 1, 0,

			// bottom
			0, -1, 0,
			0, -1, 0,
			0, -1, 0,
			0, -1, 0,
			0, -1, 0,
			0, -1, 0
	]);

	return {
			positions: positions,
			normals: normals,
			uvs: uvs
	};

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

	// Don't perform any rendering until everything is loaded in. Could be made better...
	if (!fullyInitialized) {
		app.clear();
		requestAnimationFrame(render);
		return;
	}

	stats.begin();
	{
		camera.update();
		var dirLightViewDirection = directionalLight.viewSpaceDirection(camera);

		// Clear screen
		app.defaultDrawFramebuffer();
		app.clear();

		// Render scene
		for (var i = 0, len = meshes.length; i < len; ++i) {

			var mesh = meshes[i];

			mesh.drawCall
			.uniform('u_world_from_local', mesh.modelMatrix)
			.uniform('u_view_from_world', camera.viewMatrix)
			.uniform('u_projection_from_view', camera.projectionMatrix)
			.uniform('u_dir_light_color', directionalLight.color)
			.uniform('u_dir_light_view_direction', dirLightViewDirection)
			.draw();

		}

		var renderDelta = new Date().getTime() - startStamp;
		setTimeout( function() {
			requestAnimationFrame(render);
		}, 1000 / settings.target_fps - renderDelta-1000/120);

	}
	stats.end();

}


////////////////////////////////////////////////////////////////////////////////
