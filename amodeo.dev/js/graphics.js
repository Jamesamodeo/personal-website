import * as THREE from './resources/three/build/three.module.js'
import {BufferGeometryUtils} from './resources/three/examples/jsm/utils/BufferGeometryUtils.js';
import {OrbitControls} from './resources/three/examples/jsm/controls/OrbitControls.js';
	
function Queue() {
	this.elements = [];
}

Queue.prototype.enqueue = function (e) {
	this.elements.push(e);
};

Queue.prototype.dequeue = function () {
	   return this.elements.shift();
};

Queue.prototype.isEmpty = function () {
	   return this.elements.length == 0;
};

Queue.prototype.peek = function () {
	   return !this.isEmpty() ? this.elements[0] : undefined;
};

Queue.prototype.length = function() {
	   return this.elements.length;
}

const GEN_STEP = 15;
const TOWER_SIZE = 5;
const SCROLL_SPEED = 100;
const MESH_ORIGIN_X = -250;
const MESH_ORIGIN_Y = 0;
const MESH_ORIGIN_Z = -250;
const HORIZON_HEIGHT = 50;
const HORIZON_DISTANCE = 500;
const ORBIT_CONTROL = true;
const BASE_GEOMETRY = false;
const FIX_FRUSTUM = true;

const plane =
{
	width: 1080,
	height: 500
};

const canvas = document.querySelector('#graphics');
const renderer = new THREE.WebGLRenderer({canvas});
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
camera.position.set(0, 450, 500);
camera.lookAt(0, 0, -100);

if (ORBIT_CONTROL) {
	const controls = new OrbitControls( camera, canvas );
	controls.enableDamping = true;
	controls.enablePan = true;
	controls.minDistance = 1.2;
	controls.maxDistance = 1000;
	controls.update();
}

const initialFrustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
const geometryPlane = new THREE.PlaneGeometry( plane.width, plane.height );
const materialPlane = new THREE.MeshBasicMaterial( {color: 'navy', side: THREE.DoubleSide} );
const meshPlane = new THREE.Mesh( geometryPlane, materialPlane );
meshPlane.rotation.x = Math.PI / 2;
meshPlane.position.y = -1;
scene.add( meshPlane );

const towers = [];
const freshTowers = new Queue();
const expiredTowers = new Queue();

initTowers();

const towerGeometries = BufferGeometryUtils.mergeBufferGeometries(towers.map(t=>t.geometry), false);
let mesh;
if (BASE_GEOMETRY) {
	const baseMaterial = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );
	mesh = new THREE.LineSegments(towerGeometries, baseMaterial);
} else {
	const towerMaterial = new THREE.MeshBasicMaterial( { vertexColors: THREE.VertexColors } );
	mesh = new THREE.Mesh(towerGeometries, towerMaterial);
}
const towerMesh = mesh;
towerMesh.position.x = MESH_ORIGIN_X;
towerMesh.position.y = MESH_ORIGIN_Y;
towerMesh.position.z = MESH_ORIGIN_Z;
scene.add(towerMesh);

let then = 0;
let delta = 0;

document.addEventListener( 'mousedown', onDocumentMouseDown, false );

render();

function Tower(pos, base, height, geometry) {
	this.pos = pos;
	this.base = base;
	this.height = height;
	this.geometry = geometry;
	this.status = 0;  // fresh
}

function initTowers() {
	
	let x, y;
	x = GEN_STEP;
	
	while (x < plane.width) {
		y = GEN_STEP;
		while (y < plane.height) {
			
			const tower = genTower({x: x + rand(-1.5, 1.5), y: y + rand(-1.5, 1.5)});
			tower.status = 1;  // initial towers are visible
			
			towers.push(tower);

			// make leftmost column of towers fresh
			if (x === GEN_STEP) {
				tower.status = 0;
				freshTowers.enqueue(towers.length - 1);
			}
			
			y += GEN_STEP;
		}
		x += GEN_STEP;
	}
}

function resetMeshOrigin() {

	let offsetX = towerMesh.position.x - MESH_ORIGIN_X;
	let offsetY = towerMesh.position.y - MESH_ORIGIN_Y;
	let offsetZ = towerMesh.position.z - MESH_ORIGIN_Z;

	for (let tower of towers) {
		translateGeometry(tower.geometry, offsetX, offsetY, offsetZ);
		tower.pos.x += offsetX;
		tower.pos.y += offsetY;
		tower.pos.z += offsetZ;
	}

	translateGeometry(towerGeometries, offsetX, offsetY, offsetZ);
	
	towerMesh.position.x = MESH_ORIGIN_X;
	towerMesh.position.y = MESH_ORIGIN_Y;
	towerMesh.position.z = MESH_ORIGIN_Z;

}

function translateGeometry(geometry, x, y, z) {
	for (let i = 0; i < geometry.attributes.position.array.length; i += 3) {
		geometry.attributes.position.array[i] += x; 
		geometry.attributes.position.array[i + 1] += y; 
		geometry.attributes.position.array[i + 2] += z; 
	}

	geometry.computeBoundingBox();
	geometry.attributes.position.needsUpdate = true;
}

function updateTowers() {

	for (let i = 0; i < towers.length; i++) {
		if (towers[i].status == 1) {  // if visible
			if (!geometryInFrustum(towers[i].geometry)) {
				expiredTowers.enqueue(i);
				towers[i].status = 2;  // expired
			}
		}
	}

	for (let i = 0; i < freshTowers.length(); i++) {
		if (geometryInFrustum(towers[freshTowers.elements[i]].geometry)) {
			if (!expiredTowers.isEmpty()) {
				let replacedIdx = expiredTowers.dequeue();
				
				// generate new tower
				let newPos = findAdjacentPos(towers[freshTowers.elements[i]]);
				const newTower = genTower(newPos);

				// replace tower in towers array
				towers[replacedIdx] = newTower;
				
				// replace tower in merged geometry
				for (let j = 0; j < 24; j++) {
					towerGeometries.attributes.position.array[(replacedIdx * 24) + j] = newTower.geometry.attributes.position.array[j];

				}
				towerGeometries.attributes.position.needsUpdate = true;
				
				// fresh tower now visible
				towers[freshTowers.elements[i]].status = 1;  // visible
				freshTowers.elements.splice(i, 1);

				// new tower is fresh
				freshTowers.enqueue(replacedIdx);

			}
		}
	}

	if (towerMesh.position.x > 0) {
		resetMeshOrigin();
	}
}

function posInTower(pos) {

	const raycaster = new THREE.Raycaster();
	const origin = new THREE.Vector3(pos.x, 0, pos.y).applyMatrix4( baseMesh.matrixWorld );
	const direction = new THREE.Vector3(100,0,100);

	raycaster.set(origin, direction)
	raycaster.params.Mesh.threshold = 3;
	const intersects = raycaster.intersectObjects( baseMesh );

    direction.normalize();

    var distance = 100; // at what distance to determine pointB

    var end = new THREE.Vector3();
    end.addVectors ( origin, direction.multiplyScalar( distance ) );

    const points = [];
    points.push( origin );
    points.push( end );
	const geometry = new THREE.BufferGeometry().setFromPoints(points);
    var material = new THREE.LineBasicMaterial( { color : 0xff0000 } );
    var line = new THREE.Line( geometry, material );
    scene.add( line );
	
	return intersects.length > 0;
}

function findAdjacentPos(tower) {
	let newPos = tower.pos;
	/*if (posInTower(newPos)) {
		console.log("BAM");
	}*/
	newPos.x -= GEN_STEP;
	newPos.x += rand(-1.5, 1.5);
	newPos.y += rand(-1.5, 1.5);
	return newPos;
}

function genTower({x, y}) {
	
	let tower = new Tower({x, y}, null, Math.floor(rand(5, 50)), null);
	tower.base = {
		p1: { x: x - TOWER_SIZE, y: y - TOWER_SIZE },
		p2: { x: x - TOWER_SIZE, y: y }, 
		p3: { x: x, y: y }, 
		p4: { x: x, y: y - TOWER_SIZE }}
	const color = new THREE.Color(`hsl(${THREE.MathUtils.mapLinear(tower.height, 5, 50, 127, 0)}, 30%, 50%)`);
	tower.geometry = BASE_GEOMETRY ? genBaseGeometry(tower.base, color) : genTowerGeometry(tower.base, tower.height, color);
	return tower;
}

function genBaseGeometry({p1, p2, p3, p4}, color) {
	const points = [];
	
	points.push( new THREE.Vector3( p1.x, 0, p1.y ) );
	points.push( new THREE.Vector3( p2.x, 0, p2.y ) );
	
	points.push(points[1]);
	points.push( new THREE.Vector3( p3.x, 0, p3.y ) );
	
	points.push(points[3]);
	points.push( new THREE.Vector3( p4.x, 0, p4.y ) );
	
	points.push(points[5]);
	points.push(points[0]);

	const geometry = new THREE.BufferGeometry().setFromPoints(points);
	
	const colors = [];
	for (let i = 0; i < 24; i++) {
		colors.push(color.toArray()[i%3]);
	}
	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );

	geometry.computeBoundingBox();

	return geometry;
}

function genTowerGeometry({p1, p2, p3, p4}, height, color) {

	const vertices = [];
	vertices.push(p1.x, 0, p1.y);
	vertices.push(p2.x, 0, p2.y);
	vertices.push(p3.x, 0, p3.y);
	vertices.push(p4.x, 0, p4.y);
	vertices.push(p1.x, height, p1.y);
	vertices.push(p2.x, height, p2.y);
	vertices.push(p3.x, height, p3.y);
	vertices.push(p4.x, height, p4.y);

	const indices = [];
	indices.push(2, 1, 0);
	indices.push(0, 3, 2);
	indices.push(0, 1, 4);
	indices.push(4, 1, 5);
	indices.push(1, 2, 5);
	indices.push(5, 2, 6);
	indices.push(2, 3, 6);
	indices.push(6, 3, 7);
	indices.push(3, 0, 7);
	indices.push(7, 0, 4);
	indices.push(4, 5, 6);
	indices.push(6, 7, 4);
	

	const geometry = new THREE.BufferGeometry();
	geometry.setIndex( indices );
	geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );
	
	const colors = [];
	for (let i = 0; i < 3 * 8; i++) {
		colors.push(color.toArray()[i%3]);
	}
	geometry.setAttribute( 'color', new THREE.Float32BufferAttribute( colors, 3 ) );
	

	geometry.computeBoundingBox();

	return geometry;
}

function setTowerColor(idx, color) {
	for (let i = 0; i < 24; i++) {
		towerGeometries.attributes.color.array[(idx * 24) + i] = color.toArray()[i % 3];
	}
	towerGeometries.attributes.color.needsUpdate = true;
}

function geometryInFrustum(geometry) {
	camera.updateMatrix();
	camera.updateMatrixWorld();
	
	var frustum;
	if (FIX_FRUSTUM) {
		frustum = initialFrustum;
	} else {
		frustum = new THREE.Frustum();
		frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
	}

	const box = new THREE.Box3();
	box.copy( geometry.boundingBox ).applyMatrix4( towerMesh.matrixWorld );
	return frustum.intersectsBox(box);
	
}
	
function rand(min, max) {

	if (max === undefined) {
		max = min;
		min = 0;
	}
	
	return min + (max - min) * Math.random();
	
}

function resizeRendererToDisplaySize(renderer) {

	const canvas = renderer.domElement;
	const width = canvas.clientWidth;
	const height = canvas.clientHeight;
	const needResize = canvas.width !== width || canvas.height !== height;
	
	if (needResize) {
		renderer.setSize(width, height, false);
	}
	
	return needResize;
	
}

function update(time) {
	delta = time - then;
	then = time;
	
	if (delta) {
		towerMesh.position.x += (delta * SCROLL_SPEED);
	}
	
	updateTowers();
}

function render(time) {
	time *= 0.001;	// convert to seconds
	
	update(time);
	
	if (resizeRendererToDisplaySize(renderer)) {
		const canvas = renderer.domElement;
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
	}
	
	renderer.render(scene, camera);
	requestAnimationFrame(render);
	
}

function onDocumentMouseDown( event ) {
	event.preventDefault();
}