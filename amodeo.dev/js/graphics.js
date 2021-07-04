import * as THREE from './resources/three/build/three.module.js'
import {BufferGeometryUtils} from './resources/three/examples/jsm/utils/BufferGeometryUtils.js';
import {OrbitControls} from './resources/three/examples/jsm/controls/OrbitControls.js';

const CHUNK_ROWS = 5;
const CHUNK_COLS = 12;
const TOWERS_PER_CHUNK = 20;
const CHUNK_SIZE = 100;
const CHUNK_CORE_SIZE = 80;
const CHUNK_CORE_OFFSET = (CHUNK_SIZE - CHUNK_CORE_SIZE) / 2;
const TOWER_SIZE = 10;
const SCROLL_SPEED = 100;
const MESH_ORIGIN = { x: 0, y: 0, z: 0 };
const ORBIT_CONTROL = true;
const BASE_GEOMETRY = false;
const ORBIT_TARGET = new THREE.Vector3( 0, 0, 0 );

const SURFACE_NEAR_WIDTH = 500;
const SURFACE_FAR_WIDTH = 1000;
const SURFACE_DEPTH = 500;
const SURFACE_ORIGIN = { x: 0 - (SURFACE_NEAR_WIDTH / 2), y: 0 }

const surface =
{
	nearLeft: SURFACE_ORIGIN,
	nearRight: { x: SURFACE_ORIGIN.x + SURFACE_NEAR_WIDTH, y: SURFACE_ORIGIN.y },
	farLeft: { x: SURFACE_ORIGIN.x - (SURFACE_FAR_WIDTH - SURFACE_NEAR_WIDTH) / 2, y: SURFACE_ORIGIN.y - SURFACE_DEPTH },
	farRight: { x: SURFACE_ORIGIN.x + (SURFACE_FAR_WIDTH + SURFACE_NEAR_WIDTH) / 2, y: SURFACE_ORIGIN.y - SURFACE_DEPTH},

	gradient: ( ( SURFACE_FAR_WIDTH - SURFACE_NEAR_WIDTH ) / 2 ) / SURFACE_DEPTH
}

const cullLine = {
	p1: { x: surface.nearRight.x, y: surface.nearRight.y },
	p2: { x: surface.farRight.x, y: surface.farRight.y }
}

let scrollSpeed = SCROLL_SPEED;

const canvas = document.querySelector('#graphics');
const renderer = new THREE.WebGLRenderer({canvas});
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
camera.position.set(0, 450, 500);

if (ORBIT_CONTROL) {
	const controls = new OrbitControls( camera, canvas );
	controls.enableDamping = false;
	controls.enablePan = true;
	controls.minDistance = 1.2;
	controls.maxDistance = 1000;
	controls.target = ORBIT_TARGET;
	controls.update();
}

const surfaceMesh = createSurfaceMesh();
scene.add( surfaceMesh );

const cullPlaneMesh = createCullPlaneMesh();
scene.add( cullPlaneMesh );

const chunks = [];
const towers = [];

for (let row = 0; row < CHUNK_ROWS; row++) {
	chunks.push([])
	for (let col = 0; col < CHUNK_COLS; col++) {
		const chunkPos = genChunkPos(row);
		chunks[chunks.length - 1].push(genChunk(chunkPos, (row * CHUNK_COLS + col) * TOWERS_PER_CHUNK * 24));
	}
}

const towerGeometries = BufferGeometryUtils.mergeBufferGeometries(towers.map(t=>t.geometry), false);
let towerMesh;
if (BASE_GEOMETRY) {
	const baseMaterial = new THREE.LineBasicMaterial( { vertexColors: THREE.VertexColors } );
	towerMesh = new THREE.LineSegments(towerGeometries, baseMaterial);
} else {
	const towerMaterial = new THREE.MeshBasicMaterial( { vertexColors: THREE.VertexColors } );
	towerMesh = new THREE.Mesh(towerGeometries, towerMaterial);
}
towerMesh.position.x = MESH_ORIGIN.x;
towerMesh.position.y = MESH_ORIGIN.y;
towerMesh.position.z = MESH_ORIGIN.z;
scene.add(towerMesh);

for (const col of chunks) {
	for (const chunk of col) {
		initChunkMesh(chunk);
	}
}

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

function Chunk(pos, geometryIndex, col) {
	this.pos = pos;
	this.towers = [];
	this.mesh = null;
	this.geometryIndex = geometryIndex;
	this.col = col;
}

function initChunkMesh(chunk) {
	const geo = new THREE.PlaneGeometry( CHUNK_CORE_SIZE, CHUNK_CORE_SIZE );
	const mat = new THREE.MeshBasicMaterial( {color: chunk.col, side: THREE.DoubleSide} );
	chunk.mesh = new THREE.Mesh( geo, mat );
	chunk.mesh.position.x = chunk.pos.x + CHUNK_CORE_SIZE / 2 + CHUNK_CORE_OFFSET;
	chunk.mesh.position.y = 1;
	chunk.mesh.position.z = chunk.pos.y + CHUNK_CORE_SIZE / 2 + CHUNK_CORE_OFFSET;
	chunk.mesh.rotation.x = Math.PI / 2;
	towerMesh.add( chunk.mesh );
}

function createSurfaceMesh() {
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
	return new THREE.Mesh( surfaceGeometry, surfaceMaterial );
}

function createCullPlaneMesh() {
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
	return new THREE.Mesh( cullPlaneGeometry, cullPlaneMaterial );
}

function genChunkPos(row) {
	if (chunks[row].length > 0) {
		const joinedChunk = chunks[row][chunks[row].length - 1];
		let chunkPos = { 
			x: joinedChunk.pos.x - CHUNK_CORE_SIZE - CHUNK_CORE_OFFSET, 
			y: joinedChunk.pos.y
		};
		return chunkPos;
	} else {
		return { x: 0, y: (-CHUNK_SIZE) - ((CHUNK_CORE_SIZE + CHUNK_CORE_OFFSET) * row) };
	}
}

function genChunk(chunkPos, geometryIndex) {
	const col = new THREE.Color(`hsl(${rand(0, 255)}, 80%, 20%)`);
	const chunk = new Chunk(chunkPos, geometryIndex, col);

	for (let i = 0; i < TOWERS_PER_CHUNK; i++) {
		const towerPos = genTowerPos(chunkPos);
		const tower = genTower(towerPos);
		towers.push(tower);
		chunk.towers.push(tower);
	}

	return chunk;
}

/*
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
}*/

function genTowerPos(chunkPos) {
	let towerPos = { x: chunkPos.x, y: chunkPos.y };
	towerPos.x += rand(0, CHUNK_SIZE);
	towerPos.y += rand(0, CHUNK_SIZE);
	return towerPos;
}

function genTower({x, y}) {
	let tower = new Tower({x, y}, null, rand(5, 50), null);
	tower.base = {
		p1: { x: x, y: y },
		p2: { x: x, y: y + TOWER_SIZE }, 
		p3: { x: x + TOWER_SIZE, y: y + TOWER_SIZE }, 
		p4: { x: x + TOWER_SIZE, y: y }}
	const color = new THREE.Color(`hsl(${THREE.MathUtils.mapLinear(tower.height, 5, 50, 127, 0)}, 30%, 50%)`);
	tower.geometry = BASE_GEOMETRY ? genBaseGeometry(tower.base, color) : genTowerGeometry(tower.base, tower.height, color);
	return tower;
}

function genBaseGeometry({p1, p2, p3, p4}, color) {
	const points = [];
	
	points.push( new THREE.Vector3( p1.x, 1, p1.y ) );
	points.push( new THREE.Vector3( p2.x, 1, p2.y ) );
	
	points.push(points[1]);
	points.push( new THREE.Vector3( p3.x, 1, p3.y ) );
	
	points.push(points[3]);
	points.push( new THREE.Vector3( p4.x, 1, p4.y ) );
	
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

function updateChunks() {
	

	for (let row = 0; row < CHUNK_ROWS; row++) {
		for (let col = 0; col < CHUNK_COLS; col++) {

			const chunkPosInWorld = { 
				x: chunks[row][col].pos.x + towerMesh.position.x,
				y: chunks[row][col].pos.y + towerMesh.position.z
			};

			if (pointOnLineSide(chunkPosInWorld, cullLine, true)) {
				const newChunkPos = genChunkPos(row);
				const newChunk = genChunk(newChunkPos, chunks[row][col].geometryIndex);
				initChunkMesh(newChunk);
				chunks[row].shift().mesh.removeFromParent();
				chunks[row].push(newChunk);
				updateGeometry(newChunk.geometryIndex, newChunk);	
				col -= 1;
			}
		}
	}

	if (towerMesh.position.x > 100) {
		resetMeshOrigin();
	}
}

function updateGeometry(idx, chunk) {
	
	for (let i = 0; i < TOWERS_PER_CHUNK; i++) {
		for (let j = 0; j < 24; j++) {
			towerGeometries.attributes.position.array[idx + (i * 24) + j] = chunk.towers[i].geometry.attributes.position.array[j];
		}
	}

	towerGeometries.attributes.position.needsUpdate = true;

}

function resetMeshOrigin() {

	let offsetX = towerMesh.position.x - MESH_ORIGIN.x;
	let offsetY = towerMesh.position.y - MESH_ORIGIN.y;
	let offsetZ = towerMesh.position.z - MESH_ORIGIN.z;

	for (const tower of towers) {
		translateGeometry(tower.geometry, offsetX, offsetY, offsetZ);
		tower.pos.x += offsetX;
		tower.pos.y += offsetZ;

		for (let p in tower.base) {
			tower.base[p].x += offsetX;
			tower.base[p].y += offsetZ;
		}
	}

	for (const row of chunks) {
		for (const chunk of row) {
			chunk.pos.x += offsetX;
			chunk.pos.y += offsetZ;
			chunk.mesh.position.x += offsetX;
			chunk.mesh.position.y += offsetY;
			chunk.mesh.position.z += offsetZ;
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

function setTowerColor(idx, color) {
	for (let i = 0; i < 24; i++) {
		towerGeometries.attributes.color.array[(idx * 24) + i] = color.toArray()[i % 3];
	}
	towerGeometries.attributes.color.needsUpdate = true;
}

function pointOnShape(point, {topLeft, topRight, botLeft, botRight}) {

	const gradTLTR = (topRight.y - topLeft.y) / (topRight.x - topLeft.x);
	const gradBLTL = -(topLeft.x - botLeft.x) / (topLeft.y - botLeft.y);
	const gradBLBR = (botRight.y -botLeft.y) / (botRight.x - botLeft.x);
	const gradBRTR = -(topRight.x - botRight.x) / (topRight.y - botRight.y);

	return (point.x >= botLeft.x + gradBLTL * (botLeft.y - point.y) && 
		point.x <= botRight.x + gradBRTR * (botRight.y - point.y) &&
		point.y <= botLeft.y + gradBLBR * (point.x - botLeft.x) &&
		point.y >= topLeft.y + gradTLTR * (point.x - topLeft.x));

}

function pointOnLineSide(point, { p1, p2 }, greaterThan) {
	const gradient = -(p2.y - p1.y) / (p2.x - p1.x);
	const invGradient = 1/gradient;

	if (greaterThan) {
		return point.x > p1.x + invGradient * -(point.y - p1.y) &&
			point.y > -(p1.y + gradient * (point.x - p1.x));
	} else {
		return point.x < p1.x + invGradient * -(point.y - p1.y) &&
			point.y < -(p1.y + gradient * (point.x - p1.x));
	}
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
		updateChunks();
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
	updateChunks();
	scrollSpeed == 0 ? scrollSpeed = SCROLL_SPEED : scrollSpeed = 0;
}