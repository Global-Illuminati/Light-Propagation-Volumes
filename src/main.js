
// Add stats
var stats = new Stats();

document.body.appendChild(stats.dom);
stats.showPanel(1); // (frame time)

// Add GUI panel
var gui = new dat.GUI();

var settings = {
	target_fps: 60,
};

var clock, render_clock;
var camera, controls, scene, renderer;

window.addEventListener('resize', resize, false);

init();
render();

////////////////////////////////////////////////////////////////////////////////


function init() {

	clock = new THREE.Clock();
	render_clock = new THREE.Clock();

	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
	camera.position.set(0, 2, 0);


	scene = new THREE.Scene();

	var ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
	scene.add(ambientLight);

	light = new THREE.DirectionalLight(0xffffff, 0.5);
	light.position.x = 20;
	light.position.y = 60;
	light.position.z = 5;
	light.target = new THREE.Object3D();
	light.castShadow = true;
	light.shadow.mapSize.width = 2048;
	light.shadow.mapSize.height = 2048;
	light.shadow.camera.zoom = 0.25;
	scene.add(light);
	scene.add(light.target);

	scene.add(new THREE.DirectionalLightHelper(light));
	scene.add(new THREE.CameraHelper(light.shadow.camera));

	// Load in some scene
	var loader = new THREE.ObjectLoader();
	loader.load('assets/sponza/sponza.json', function(object) {

		object.castShadow = true;
		object.receiveShadow = true;

		object.traverse(function(child) {
				child.castShadow = true;
				child.receiveShadow = true;
		});

		scene.add(object);

/*
		// Set camera to the camera from the scene
		object.traverse(function(child) {
			if (child instanceof THREE.PerspectiveCamera) {
				camera = child;
			}
		});
*/
	});

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;
	renderer.shadowMap.type = THREE.PCFSoftShadowMap;
	document.body.appendChild(renderer.domElement);

	controls = new THREE.FirstPersonControls(camera,renderer.domElement);
	controls.movementSpeed = 2.2;
	controls.lookSpeed = 0.25;

	gui.add(settings, 'target_fps', 0, 120);
}

////////////////////////////////////////////////////////////////////////////////

function resize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize(window.innerWidth, window.innerHeight);
	controls.handleResize();

}

////////////////////////////////////////////////////////////////////////////////

function render() {
	var start_stamp= new Date().getTime();
	stats.begin();
	var delta = clock.getDelta();
	controls.update(delta);
	renderer.render(scene, camera);
	stats.end();

	var render_delta = new Date().getTime()-start_stamp;
	setTimeout( function() {
		requestAnimationFrame( render);
	}, 1000 / settings.target_fps - render_delta-1000/120);	
	
}


////////////////////////////////////////////////////////////////////////////////
