
// Add stats
var stats = new Stats();
document.body.appendChild(stats.dom);
stats.showPanel(1); // (frame time)

// Add GUI panel
var gui = new dat.GUI();

var state = {
	clearColor: 0x000
};

var camera, scene, renderer;
var geometry, material, mesh;

window.addEventListener('resize', resize, false);

init();
render();

////////////////////////////////////////////////////////////////////////////////

function init() {

	camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.01, 10);
	camera.position.z = 1;

	scene = new THREE.Scene();

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

}

////////////////////////////////////////////////////////////////////////////////

function render() {
	stats.begin();

	mesh.rotation.x += 0.01;
	mesh.rotation.y += 0.02;

	renderer.render(scene, camera);

	stats.end();
	requestAnimationFrame(render);
}

////////////////////////////////////////////////////////////////////////////////
