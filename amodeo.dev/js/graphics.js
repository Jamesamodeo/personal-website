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

const TOWER_COUNT = 200;
const POS_SCAN_COUNT = 5;
const POS_RAY_STEP = 10;
const TOWER_SIZE = 10;
const SCROLL_SPEED = 100;
const MESH_ORIGIN = { x: -250, y: 0, z: -250 };
const ORBIT_CONTROL = true;
const BASE_GEOMETRY = false;
const ORBIT_TARGET = new THREE.Vector3();

const SURFACE_NEAR_WIDTH = 500;
const SURFACE_FAR_WIDTH = 1000;
const SURFACE_DEPTH = 500;
const SURFACE_ORIGIN = { x: 0 - (SURFACE_NEAR_WIDTH / 2), y: 0 }

let scrollSpeed = SCROLL_SPEED;

const canvas = document.querySelector('#graphics');
const renderer = new THREE.WebGLRenderer({canvas});
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
camera.position.set(0, 450, 500);

if (ORBIT_CONTROL) {
	const controls = new OrbitControls( camera, canvas );
	controls.enableDamping = true;
	controls.enablePan = true;
	controls.minDistance = 1.2;
	controls.maxDistance = 1000;
	controls.target = ORBIT_TARGET;
	controls.update();
}

let surface =
{
	nearLeft: SURFACE_ORIGIN,
	nearRight: { x: SURFACE_ORIGIN.x + SURFACE_NEAR_WIDTH, y: SURFACE_ORIGIN.y },
	farLeft: { x: SURFACE_ORIGIN.x - (SURFACE_FAR_WIDTH - SURFACE_NEAR_WIDTH) / 2, y: SURFACE_ORIGIN.y - SURFACE_DEPTH },
	farRight: { x: SURFACE_ORIGIN.x + (SURFACE_FAR_WIDTH + SURFACE_NEAR_WIDTH) / 2, y: SURFACE_ORIGIN.y - SURFACE_DEPTH},

	gradient: ( ( SURFACE_FAR_WIDTH - SURFACE_NEAR_WIDTH ) / 2 ) / SURFACE_DEPTH
}

const surfaceGeometry = new THREE.BufferGeometry();
const surfaceVertices = new Float32Array( [
	surface.nearRight.x, 0, surface.nearRight.y,
	surface.farLeft.x, 0, surface.farLeft.y,
	surface.nearLeft.x, 0, surface.nearLeft.y,

	surface.farRight.x, 0, surface.farRight.y,
	surface.farLeft.x, 0, surface.farLeft.y,
	surface.nearRight.x, 0, surface.nearRight.y
] );
surfaceGeometry.setAttribute( 'position', new THREE.BufferAttribute( surfaceVertices, 3 ) );
const surfaceMaterial = new THREE.MeshBasicMaterial( { color: 'navy' } );
const surfaceMesh = new THREE.Mesh( surfaceGeometry, surfaceMaterial );
scene.add( surfaceMesh );

const cullPlaneGeometry = new THREE.BufferGeometry();
const cullPlaneVertices = new Float32Array( [
	surface.nearRight.x, 0, surface.nearRight.y,
	surface.farRight.x, 20, surface.farRight.y,
	surface.farRight.x, 0, surface.farRight.y,

	surface.nearRight.x, 20, surface.nearRight.y,
	surface.farRight.x, 20, surface.farRight.y,
	surface.nearRight.x, 0, surface.nearRight.y
] );
cullPlaneGeometry.setAttribute( 'position', new THREE.BufferAttribute( cullPlaneVertices, 3 ) );
const cullPlaneMaterial = new THREE.MeshBasicMaterial( { color: 'grey' } );
const cullPlaneMesh = new THREE.Mesh( cullPlaneGeometry, cullPlaneMaterial );
scene.add( cullPlaneMesh );

const towers = [];

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
towerMesh.position.x = MESH_ORIGIN.x;
towerMesh.position.y = MESH_ORIGIN.y;
towerMesh.position.z = MESH_ORIGIN.z;
scene.add(towerMesh);

const debugLines = [];
const debugMeshes = [];

let then = 0;
let delta = 0;

document.addEventListener( 'keydown', onDocumentKeyDown, false );

render();

function Tower(pos, base, height, geometry) {
	this.pos = pos;
	this.base = base;
	this.height = height;
	this.geometry = geometry;
}

function initTowers() {
	for (let i = 0; i < TOWER_COUNT; i++) {
		//const newPos = genTowerPos();
		const tower = genTower({x: rand(-200, 500), y: rand(-200, 200)});
		towers.push(tower);
	}
}

function resetMeshOrigin() {

	let offsetX = towerMesh.position.x - MESH_ORIGIN.x;
	let offsetY = towerMesh.position.y - MESH_ORIGIN.y;
	let offsetZ = towerMesh.position.z - MESH_ORIGIN.z;

	for (let tower of towers) {
		translateGeometry(tower.geometry, offsetX, offsetY, offsetZ);
		tower.pos.x += offsetX;
		tower.pos.y += offsetZ;

		for (let p in tower.base) {
			tower.base[p].x += offsetX;
			tower.base[p].y += offsetZ;
		}
	}

	translateGeometry(towerGeometries, offsetX, offsetY, offsetZ);
	
	towerMesh.position.x = MESH_ORIGIN.x;
	towerMesh.position.y = MESH_ORIGIN.y;
	towerMesh.position.z = MESH_ORIGIN.z;

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
		if (!towerOnSurface(towers[i])) {
			const newPos = genTowerPos();
			const newTower = genTower(newPos);
			updateTowerGeometry(i, newTower);			
		}
	}

	if (towerMesh.position.x > 0) {
		resetMeshOrigin();
	}
}

/*
function genTowerPos() {
	const scanOrigin = new THREE.Vector3(surface.nearLeft.x, 1, surface.nearLeft.y);
	const scanEnd = new THREE.Vector3(surface.farLeft.x, 1, surface.farLeft.y);
	const scanStep = new THREE.Vector3().subVectors(scanEnd, scanOrigin).divideScalar(POS_SCAN_COUNT + 1);	

	let scanPos;
	let furthestDistance = 0;
	let furthestIntersection = null;

	while (debugLines.length > 0) {
		debugLines.pop().removeFromParent();
	}

	for (let i = 0; i < POS_SCAN_COUNT; i++) {
		
		//scanPos = scanOrigin.clone().add(scanStep.clone().multiplyScalar((i + 1) + rand(-POS_SCAN_NOISE, POS_SCAN_NOISE)));
		scanPos = scanOrigin.clone().add(scanStep.clone().multiplyScalar((Math.floor(rand(0, POS_SCAN_COUNT-1)) + 1) + rand(-POS_SCAN_NOISE, POS_SCAN_NOISE)));

		const raycaster = new THREE.Raycaster();
		const direction = new THREE.Vector3(1,0,0);

		raycaster.set(scanPos, direction)
		const intersections = raycaster.intersectObjects( [towerMesh, cullPlaneMesh] );		

		const intersect = intersections[0];

		if (intersections.length == 1) {
			furthestDistance = Number.POSITIVE_INFINITY;
			furthestIntersection = intersect.point;
		} else if (intersect.distance > furthestDistance) {
			furthestDistance = intersect.distance;
			furthestIntersection = intersect.point;
		}
		
		const distance = 50;
		let end = intersections.length > 1 ? intersections[0].point : new THREE.Vector3().addVectors( scanPos,  direction.multiplyScalar( distance ) );
		const points = [];
		points.push( scanPos );
		points.push( end );
		const geometry = new THREE.BufferGeometry().setFromPoints(points);
		const material = new THREE.LineBasicMaterial( { color : intersections.length == 0 ? 0x00ff00 : 0xff0000 } );
		const line = new THREE.Line( geometry, material );
		debugLines.push( line );
		scene.add( line );
	}

	let pos = { x: furthestIntersection.x - towerMesh.position.x, y: furthestIntersection.z - towerMesh.position.z };
	let xOffset = TOWER_SIZE + rand(3, 20);
	pos.x -= xOffset;

	return pos;
}
*/

function pointBuildable(point) {

	let pos = {x: point.x - towerMesh.position.x, y: point.y - towerMesh.position.z};
	const basePoints = [
		{ x: pos.x, y: pos.y },
		{ x: pos.x, y: pos.y + TOWER_SIZE }, 
		{ x: pos.x + TOWER_SIZE, y: pos.y + TOWER_SIZE }, 
		{ x: pos.x + TOWER_SIZE, y: pos.y }
	];
	
	for (const tower of towers) {
		const shape = {
			topLeft: tower.base.p1,
			topRight: tower.base.p4,
			botLeft: tower.base.p2,
			botRight: tower.base.p3
		};
		for (const point of basePoints) {
			if (pointInShape(point, shape)) {
				return false;
			}
		}
	}
	return true;
}

function genTowerPos() {

	const scanOrigin = new THREE.Vector3(surface.nearRight.x-1, 1, surface.nearRight.y+1);
	const scanEnd = new THREE.Vector3(surface.farRight.x-1, 1, surface.farRight.y-1);
	const scanInterval = new THREE.Vector3().subVectors(scanEnd, scanOrigin).divideScalar(POS_SCAN_COUNT);
	const rayDir = { x: -1, y: 0 };

	const surfaceShape = {
		topLeft: surface.farLeft,
		topRight: surface.farRight,
		botLeft: surface.nearLeft,
		botRight: surface.nearRight
	};

	let emptyPos = { x: null, y: null };
	//let emptyPosDist = Number.POSITIVE_INFINITY;

	for (let i = 0; i < POS_SCAN_COUNT; i++) {
		
		const rayOrigin = scanOrigin.clone().add(scanInterval.clone().multiplyScalar(i + rand(0, 1)));
		
		let rayPos = { x: rayOrigin.x, y: rayOrigin.z };
		//let travelledDist = 0;
		let rayEnded = false;

		//while (travelledDist < emptyPosDist && !rayEnded && pointInShape(rayPos, surfaceShape)) {
		while (!rayEnded && pointInShape(rayPos, surfaceShape)) {
		
			if (pointBuildable(rayPos)) {
				emptyPos.x = rayPos.x;
				emptyPos.y = rayPos.y;
				//emptyPosDist = travelledDist;
				rayEnded = true;
			}

			rayPos.x += rayDir.x * POS_RAY_STEP;
			rayPos.y += rayDir.y * POS_RAY_STEP;
			//travelledDist += POS_RAY_STEP;
		}
	}

	let pos = {x: emptyPos.x - towerMesh.position.x, y: emptyPos.y - towerMesh.position.z};
	return pos;
}

function genTower({x, y}) {
	
	let tower = new Tower({x, y}, null, Math.floor(rand(5, 50)), null);
	tower.base = {
		p1: { x: x, y: y },
		p2: { x: x, y: y + TOWER_SIZE }, 
		p3: { x: x + TOWER_SIZE, y: y + TOWER_SIZE }, 
		p4: { x: x + TOWER_SIZE, y: y }}
	const color = new THREE.Color(`hsl(${THREE.MathUtils.mapLinear(tower.height, 5, 50, 127, 0)}, 30%, 50%)`);
	tower.geometry = BASE_GEOMETRY ? genBaseGeometry(tower.base, color) : genTowerGeometry(tower.base, tower.height, color);
	return tower;
}

function updateTowerGeometry(idx, tower) {

	towers[idx] = tower;

	for (let i = 0; i < 24; i++) {
		towerGeometries.attributes.position.array[(idx * 24) + i] = tower.geometry.attributes.position.array[i];
	}

	towerGeometries.attributes.position.needsUpdate = true;

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

function pointInShape(point, {topLeft, topRight, botLeft, botRight}) {

	const gradTLTR = (topRight.y - topLeft.y) / (topRight.x - topLeft.x);
	const gradBLTL = -(topLeft.x - botLeft.x) / (topLeft.y - botLeft.y);
	const gradBLBR = (botRight.y -botLeft.y) / (botRight.x - botLeft.x);
	const gradBRTR = -(topRight.x - botRight.x) / (topRight.y - botRight.y);

	return (point.x >= botLeft.x + gradBLTL * (botLeft.y - point.y) && 
		point.x <= botRight.x + gradBRTR * (botRight.y - point.y) &&
		point.y <= botLeft.y + gradBLBR * (point.x - botLeft.x) &&
		point.y >= topLeft.y + gradTLTR * (point.x - topLeft.x));

}

function towerOnSurface(tower) {

	for (let corner in tower.base) {

		const point = {
			x: tower.base[corner].x + towerMesh.position.x, 
			y: tower.base[corner].y + towerMesh.position.z
		};

		const shape = {
			topLeft: surface.farLeft,
			topRight: surface.farRight,
			botLeft: surface.nearLeft,
			botRight: surface.nearRight
		};

		if (pointInShape(point, shape)) {
			return true;
		}

	}

	return false;
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
		towerMesh.position.x += (delta * scrollSpeed);
	}
	
	if (time > 1) {
		updateTowers();
	}
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

function onDocumentKeyDown( event ) {
	event.preventDefault();
	updateTowers();
	scrollSpeed == 0 ? scrollSpeed = SCROLL_SPEED : scrollSpeed = 0;
}