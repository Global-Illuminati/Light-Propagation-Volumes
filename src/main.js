
// Add stats
var stats = new Stats();
document.body.appendChild(stats.dom);
stats.showPanel(1); // (frame time)

// Add GUI panel
var gui = new dat.GUI();

var state = {
	clearColor: 0x000
};

var clock;
var camera, controls, scene, renderer;
var geometry, material, mesh;

window.addEventListener('resize', resize, false);

init();
render();

////////////////////////////////////////////////////////////////////////////////

function init() {

	clock = new THREE.Clock();

	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 1000);
	camera.position.set(0, -2, 1);

	controls = new THREE.FirstPersonControls(camera);
	controls.movementSpeed = 2.2;
	controls.lookSpeed = 0.25;

	scene = new THREE.Scene();

	// White directional light at half intensity shining from the top.
	var directionalLight = new THREE.DirectionalLight( 0xffffff, 0.5 );
	directionalLight.castShadows = true;
	scene.add( directionalLight );

	// Load in some scene
	var loader = new THREE.ObjectLoader();
	loader.load('assets/sponza/sponza.json', function(object) {

		// Add loaded object to the scene
		scene.add(object);

		// Set camera to the camera from the scene
/*
		object.traverse(function(child) {
			if (child instanceof THREE.PerspectiveCamera) {
				camera = child;
			}
		});
*/
	});

	geometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
	material = new THREE.MeshNormalMaterial();
	mesh = new THREE.Mesh(geometry, material);
	scene.add(mesh);

	renderer = new THREE.WebGLRenderer({ antialias: true });
	renderer.setSize(window.innerWidth, window.innerHeight);
	document.body.appendChild(renderer.domElement);

	// Add controls to the GUI panel
	gui.addColor(state, 'clearColor').onChange(function(color) {
		renderer.setClearColor(new THREE.Color(color));
	});

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
	stats.begin();

	var delta = clock.getDelta();
	controls.update(delta);

	mesh.rotation.x += 0.01;
	mesh.rotation.y += 0.02;

	renderer.render(scene, camera);

	stats.end();
	requestAnimationFrame(render);
}

////////////////////////////////////////////////////////////////////////////////
