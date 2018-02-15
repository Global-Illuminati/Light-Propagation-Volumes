'using strict';

var stats;
var gui;
var settings = {
	target_fps: 60,
};

var app;
var fullyInitialized = false;

var camera;
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

function makeRequest(path, callback) {
	fetch(path, { method: 'GET' }).then(function(response) {
		return response.text();
	}).then(function(textData) {
		callback(textData);
	}).catch(function(error) {
		console.error('Error loading file at path "' + path + '"');
  });
}

function loadShader(vsName, fsName, callback) {

	var vsSource, fsSource;

	var basePath = 'src/shaders/';
	var vsPath = basePath + vsName;
	var fsPath = basePath + fsName;

	function assembleProgramIfSourceIsLoaded() {
		if (vsSource && fsSource) {
			var program = app.createProgram(vsSource, fsSource);
			callback(program);
		}
	}

	makeRequest(vsPath, function(source) {
		vsSource = source;
		assembleProgramIfSourceIsLoaded();
	});

	makeRequest(fsPath, function(source) {
		fsSource = source;
		assembleProgramIfSourceIsLoaded();
	});

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

	// Basic GL state
	app.clearColor(0.1, 0.1, 0.1, 1.0);
	app.cullBackfaces();
	app.noBlend();

	// Camera
	camera = {
		position: vec3.fromValues(0, 2, 0),
		rotation: quat.create(),
		fovDegrees: 70,
		near: 0.01,
		far: 1000,
		viewMatrix: mat4.create(),
		projectionMatrix: mat4.create()
	};

	// TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO
	// Skapa något mer flexibelt än detta så att vi smidigt kan ladda *flera* shaders samtidigt!
	// TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO TODO
	loadShader('test.vert.glsl', 'test.frag.glsl', function(program) {

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

		fullyInitialized = true;

	});

}

////////////////////////////////////////////////////////////////////////////////

function resize() {

	var w = window.innerWidth;
	var h = window.innerHeight;

	app.resize(w, h);

	// Update camera view matrix
	var tempTarget = vec3.fromValues(0, 2, 1); // +1z from position
	var up = vec3.fromValues(0, 1, 0);
	mat4.lookAt(camera.viewMatrix, camera.position, tempTarget, up);

	// Update camera projection matrix
	var aspectRatio = w / h;
	var near = camera.near;
	var far = camera.far;
	var fovy = camera.fovDegrees / 180.0 * Math.PI;
	mat4.perspective(camera.projectionMatrix, fovy, aspectRatio, near, far);

}

////////////////////////////////////////////////////////////////////////////////
// Rendering

function render() {

	// Don't perform any rendering until everything is loaded in. Could be made better...
	if (!fullyInitialized) {
		return;
	}

	var startStamp = new Date().getTime();
	stats.begin();
	{
		app.clear();
		// TODO: Do rendering!
	}
	stats.end();

	var renderDelta = new Date().getTime() - startStamp;
	setTimeout( function() {
		requestAnimationFrame(render);
	}, 1000 / settings.target_fps - renderDelta-1000/120);

}


////////////////////////////////////////////////////////////////////////////////
