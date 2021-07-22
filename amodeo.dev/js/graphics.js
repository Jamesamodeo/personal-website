import * as THREE from './resources/three/build/three.module.js';
import {BufferGeometryUtils} from './resources/three/examples/jsm/utils/BufferGeometryUtils.js';
import {OrbitControls} from './resources/three/examples/jsm/controls/OrbitControls.js';

const MAX_TOWERS_PER_CHUNK = 12;
const MIN_TOWERS_PER_CHUNK = 4;
const GAP_SIZE = 8;
const GAP_CHANCE = 0.1;
const PAD_CHANCE = 0.3;
const PAD_SIZE = 10;
const TOWER_HEIGHT_MIN = 5;
const TOWER_HEIGHT_RAND_FACTOR = 30;
const TOWER_HEIGHT_AREA_FACTOR = 0.2;
const TOWER_HEIGHT_AREA_OFFSET = -30;
const TOWER_HEIGHT_PERLIN_FACTOR = 100;
const TOWER_HEIGHT_PERLIN_OFFSET = 0;

const SCROLL_SPEED = 50;
const MESH_ORIGIN = { x: 2000, y: 0, z: 0 };
const MESH_RESET_X = 2000;

const CAMERA_POS = new THREE.Vector3( 1470, 850, 395 );
const CAMERA_ROT = new THREE.Vector3( -0.23, 0.52, 0.117 );
/*
const CAMERA_POS = new THREE.Vector3( 0, 1300, 1500 );
const CAMERA_ROT = new THREE.Vector3( -0.45, 0.0, 0.0 );
*/
const FOV = 50;

const camera = new THREE.PerspectiveCamera( Math.atan(Math.tan(FOV / 360 * Math.PI) / (window.innerWidth / window.innerHeight)) * 360 / Math.PI, window.innerWidth / window.innerHeight, 1, 20000 );

const LIGHT_PATH_TIMER = 0.5;

const BASE_GEOMETRY = false;

const SURFACE_DEPTH = 4000;
const SURFACE_FAR_WIDTH = 8000;
const SURFACE_NEAR_WIDTH = 2000;

const CHUNK_SIZE = 100;
const CHUNK_ROWS = Math.floor(SURFACE_DEPTH / CHUNK_SIZE);
const CHUNK_NEAR_WIDTH = Math.floor(SURFACE_NEAR_WIDTH / CHUNK_SIZE);
const CHUNK_FAR_WIDTH = Math.floor(SURFACE_FAR_WIDTH / CHUNK_SIZE);

const SURFACE_ORIGIN = { x: 0 - (SURFACE_NEAR_WIDTH / 2) - CHUNK_SIZE * 2, y: 0 }

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

let towerMeshOffset = { x: 0, y: 0, z: 0 };

const canvas = document.querySelector('#graphics');
const renderer = new THREE.WebGLRenderer({canvas}, {antialias: false});
const scene = new THREE.Scene();

{
  const color = 0x000000;
  const near = 10;
  const far = 10000;
  scene.fog = new THREE.Fog(color, near, far);
}

/*
const loader = new THREE.TextureLoader();
const bgTexture = loader.load('js/resources/images/sunset.jpg');
scene.background = bgTexture;*/

const controls = new OrbitControls( camera, canvas );
controls.enableDamping = false;
controls.enablePan = true;
controls.minDistance = 1.2;
controls.maxDistance = 3000;
controls.update();

camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);
camera.rotation.set(CAMERA_ROT.x, CAMERA_ROT.y, CAMERA_ROT.z);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

const surfaceMesh = createSurfaceMesh();
scene.add( surfaceMesh );

const cullPlaneMesh = createCullPlaneMesh();
scene.add( cullPlaneMesh );

const chunks = [];
const towerGeometryArray = [];
let chunkCount = 0;

for (let row = 0; row < CHUNK_ROWS; row++) {
	chunks.push([])

	for (let col = 0; col < CHUNK_NEAR_WIDTH + Math.floor((row / CHUNK_ROWS) * (CHUNK_FAR_WIDTH - CHUNK_NEAR_WIDTH)); col++) {
		const chunkPos = genChunkPos(row);
		const newChunk = genChunk(chunkPos, chunkCount * MAX_TOWERS_PER_CHUNK * 24);
		chunks[chunks.length - 1].push(newChunk);
		chunkCount++;

		for (let i = 0; i < newChunk.towers.length; i++) {
			towerGeometryArray.push(newChunk.towers[i].geometry);
		}
		for (let i = newChunk.towers.length; i < MAX_TOWERS_PER_CHUNK; i++) {
			towerGeometryArray.push(genTowerGeometry({ p1: { x: 0, y: 0 }, p2: { x: 0, y: 0 } }, 0, new THREE.Color(0x000000)));
		}

	}
}

console.log(MAX_TOWERS_PER_CHUNK * CHUNK_ROWS * (SCROLL_SPEED / CHUNK_SIZE), "towers generated per second");
console.log(chunkCount * MAX_TOWERS_PER_CHUNK, " towers on screen");

const towerGeometries = BufferGeometryUtils.mergeBufferGeometries(towerGeometryArray, false);
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

const lightPath = [];
const litTowers = [];

let then = 0;
let delta = 0;

let lightPathTime = 0;

document.addEventListener( 'pointermove', onPointerMove );
document.addEventListener( 'keydown', onDocumentKeyDown, false );
document.addEventListener( 'keyup', onDocumentKeyUp, false );
document.addEventListener( 'mousedown', onMouseDown, false );
document.addEventListener( 'mouseup', onMouseUp, false );

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
	this.geometryIndex = geometryIndex;
	this.col = col;
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
	const surfaceMaterial = new THREE.MeshBasicMaterial( { color: 'black' } );
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
			x: joinedChunk.pos.x - CHUNK_SIZE, 
			y: joinedChunk.pos.y
		};
		return chunkPos;
	} else {
		return { x: 0, y: (-CHUNK_SIZE) - (CHUNK_SIZE * row) };
	}
}

function genChunk(chunkPos, geometryIndex) {
	const colour = new THREE.Color(`hsl(${randFloat(0, 255)}, 80%, 40%)`);
	const chunk = new Chunk(chunkPos, geometryIndex, colour);

	const squares = [];

	const initialSquare = {
		p1: { x: chunkPos.x, y: chunkPos.y },
		p2: { x: chunkPos.x + CHUNK_SIZE, y: chunkPos.y + CHUNK_SIZE } };
	const padLeft = randFloat(0, 1);
	const padRight = randFloat(0, 1);
	const padTop = randFloat(0, 1);
	const padBottom = randFloat(0, 1);
	if (padLeft < PAD_CHANCE) {
		initialSquare.p1.x += PAD_SIZE;
	}
	if (padRight < PAD_CHANCE) {
		initialSquare.p2.x -= PAD_SIZE;
	}
	if (padTop < PAD_CHANCE) {
		initialSquare.p1.y += PAD_SIZE;
	}
	if (padBottom < PAD_CHANCE) {
		initialSquare.p2.y -= PAD_SIZE;
	}
	squares.push([area(initialSquare), initialSquare]);

	const cutCount = rand(MIN_TOWERS_PER_CHUNK - 1, MAX_TOWERS_PER_CHUNK - 1);

	for (let i = 0; i < cutCount; i++) {
		const gap = randFloat(0, 1) < GAP_CHANCE ? GAP_SIZE : 0;
		const target = Math.floor(squares.length * Math.abs(Math.random() - Math.random()));
		const cutDirection = Math.floor(heightByWidth(squares[target][1])) ? 'y' : 'x';
		const newSquares = cut(target, randFloat(0.3, 0.6), cutDirection, gap).map(s=>[area(s), s]);
		squares.splice(target, 1);
		for (const square of newSquares) {
			insertSquare(square);
		}
	}

	while (squares.length > 0) {
		const tower = genTower(squares.pop()[1], colour);
		chunk.towers.push(tower);
	}

	return chunk;

	function cut(idx, perc, axis, gap = 0) {
		const square = squares[idx][1];
		const square1 = JSON.parse(JSON.stringify(square));
		const square2 = JSON.parse(JSON.stringify(square));
	
		if (axis == 'x') {
			const xCoord = square.p1.x + (square.p2.x - square.p1.x) * perc;
			square1.p2.x = xCoord;
			square2.p1.x = xCoord + gap;
		} else {
			const yCoord = square.p1.y + (square.p2.y - square.p1.y) * perc;
			square1.p2.y = yCoord;
			square2.p1.y = yCoord + gap;
		}
		
	
		return [square1, square2];
	}
	
	function insertSquare(square) {
		let i = 0;
		while (i < squares.length && squares[i][0] > square[0]) {
			i++;
		}
		squares.splice(i, 0, square);
	}
	
	function area(square) {
		return (square.p2.x - square.p1.x) * (square.p2.y - square.p1.y);
	}
	
	function heightByWidth(square) {
		return (square.p2.y - square.p1.y) / (square.p2.x - square.p1.x);
	}
}

function genTower(base, scolor) {
	const baseArea = (base.p2.x - base.p1.x) * (base.p2.y - base.p1.y);
	const towerHeight = Math.max( TOWER_HEIGHT_MIN,
		TOWER_HEIGHT_RAND_FACTOR * ( randFloat(-1, 1) ) +
		TOWER_HEIGHT_PERLIN_FACTOR * ( Math.max(0, TOWER_HEIGHT_PERLIN_OFFSET + perlin.get((base.p1.x - towerMeshOffset.x) / 300, (base.p1.y - towerMeshOffset.y) / 300))) +
		TOWER_HEIGHT_AREA_FACTOR * ( Math.max(0, TOWER_HEIGHT_AREA_OFFSET + getBaseLog(1.01, 1 + baseArea / 200) ))
	);
	const tower = new Tower({ x: base.p1.x, y: base.p1.y }, null, towerHeight, null);
	tower.base = base;
	const color = new THREE.Color(`hsl(0, 0%, ${Math.floor(THREE.MathUtils.mapLinear(tower.height, 5, 50, 5, 40))}%)`);
	tower.geometry = BASE_GEOMETRY ? genBaseGeometry(tower.base, color) : genTowerGeometry(tower.base, tower.height, color.clone().addScalar(0.2));
	return tower;
}

function genBaseGeometry({ p1, p2, p3, p4 }, color) {
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

function genTowerGeometry({ p1, p2 }, height, color) {

	const vertices = [];
	vertices.push(p1.x, 0, p1.y);
	vertices.push(p1.x, 0, p2.y);
	vertices.push(p2.x, 0, p2.y);
	vertices.push(p2.x, 0, p1.y);
	vertices.push(p1.x, height, p1.y);
	vertices.push(p1.x, height, p2.y);
	vertices.push(p2.x, height, p2.y);
	vertices.push(p2.x, height, p1.y);

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
		for (let col = 0; col < chunks[row].length; col++) {

			const chunkPosInWorld = { 
				x: chunks[row][col].pos.x + towerMesh.position.x,
				y: chunks[row][col].pos.y + towerMesh.position.z
			};

			if (pointOnLineSide(chunkPosInWorld, cullLine, true)) {
				const newChunkPos = genChunkPos(row);
				const newChunk = genChunk(newChunkPos, chunks[row][col].geometryIndex);
				chunks[row].shift();
				chunks[row].push(newChunk);
				updateGeometry(newChunk.geometryIndex, newChunk);	
				col -= 1;
			}
		}
	}

	if (towerMesh.position.x > MESH_RESET_X + MESH_ORIGIN.x) {
		resetMeshOrigin();
	}
}

function updateGeometry(idx, chunk) {
	for (let i = 0; i < chunk.towers.length; i++) {
		for (let j = 0; j < 24; j++) {
			towerGeometries.attributes.position.array[idx + (i * 24) + j] = chunk.towers[i].geometry.attributes.position.array[j];
			towerGeometries.attributes.color.array[idx + (i * 24) + j] = chunk.towers[i].geometry.attributes.color.array[j];
		}
	}
	for (let i = chunk.towers.length; i < MAX_TOWERS_PER_CHUNK; i++) {
		for (let j = 0; j < 24; j++) {
			towerGeometries.attributes.position.array[idx + (i * 24) + j] = 0;
			towerGeometries.attributes.color.array[idx + (i * 24) + j] = 0;
		}
	}
	towerGeometries.attributes.position.needsUpdate = true;
	towerGeometries.attributes.color.needsUpdate = true;
}

function updateTowerColor(idx, color) {
	for (let i = 0; i < 8; i++) {
		towerGeometries.attributes.color.array[(idx * 24) + (i * 3)]     = color.r;
		towerGeometries.attributes.color.array[(idx * 24) + (i * 3) + 1] = color.g;
		towerGeometries.attributes.color.array[(idx * 24) + (i * 3) + 2] = color.b;
	}
	towerGeometries.attributes.color.needsUpdate = true;
}

function resetMeshOrigin() {
	let offsetX = towerMesh.position.x - MESH_ORIGIN.x;
	let offsetY = towerMesh.position.y - MESH_ORIGIN.y;
	let offsetZ = towerMesh.position.z - MESH_ORIGIN.z;

	for (const row of chunks) {
		for (const chunk of row) {
			for (const tower of chunk.towers) {
				translateGeometry(tower.geometry, offsetX, offsetY, offsetZ);
				tower.pos.x += offsetX;
				tower.pos.y += offsetZ;
	
				for (let p in tower.base) {
					tower.base[p].x += offsetX;
					tower.base[p].y += offsetZ;
				}
			}
		}
	}

	for (const row of chunks) {
		for (const chunk of row) {
			chunk.pos.x += offsetX;
			chunk.pos.y += offsetZ;
		}
	}	

	translateGeometry(towerGeometries, offsetX, offsetY, offsetZ);
	
	towerMeshOffset.x += towerMesh.position.x - MESH_ORIGIN.x;
	towerMeshOffset.y += towerMesh.position.y - MESH_ORIGIN.y;
	towerMeshOffset.z += towerMesh.position.z - MESH_ORIGIN.z;

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
	return Math.floor(randFloat(min, max + 1));
}

function randFloat(min, max) {	
	return min + (max - min) * Math.random();
}

function getBaseLog(x, y) {
	return Math.log(y) / Math.log(x);
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

		if (lightPathTime >= LIGHT_PATH_TIMER) {
			if (lightPath.length > 0) {
				const idx = towerGeometryIndexAtPointer();
				lightPath.push(idx);
				if (idx >= 0) {
					
					updateTowerColor(idx, pathColor);
				}
			}
			lightPathTime = 0;
		}
		lightPathTime += delta;
	}
	
	if (time > 1) {
		updateChunks();
	}
}

function render(time) {
	time *= 0.001;
	
	update(time);
	
	if (resizeRendererToDisplaySize(renderer)) {
		const canvas = renderer.domElement;
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
	}
	
	renderer.render(scene, camera);
	requestAnimationFrame(render);
	
}

function onPointerMove( event ) {
	pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
	pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

let keydown = false;
let pathColor = null;

function onDocumentKeyDown( event ) {
	if (!keydown) {
		console.log("keydown");

		keydown = true;
	
		if (event.keyCode === 49) {
			scrollSpeed == 0 ? scrollSpeed = SCROLL_SPEED : scrollSpeed = 0;
		} else {
			onMouseDown(event);
		}	
	}
}

function onDocumentKeyUp( event ) {
	console.log("keyup");

	keydown = false;

	if (event.keyCode !== 49) {
		onMouseUp(event);
	}
}

function onMouseDown( event ) {
	console.log("mouseDown");

	const idx = towerGeometryIndexAtPointer();
	lightPath.push(idx);
	if (idx >= 0) {
		pathColor = new THREE.Color(`hsl(${randFloat(0, 255)}, 100%, 50%)`);
		updateTowerColor(idx, pathColor);
	}
}

function onMouseUp( event ) {
	console.log("mouseUp");

	lightPath.splice(0, lightPath.length);
}

function towerGeometryIndexAtPointer() {
	raycaster.setFromCamera( pointer, camera );
	const intersects = raycaster.intersectObject( towerMesh );
	if (intersects.length > 0) {
		const faceIndex = intersects[ 0 ].faceIndex;
		return Math.floor(faceIndex / 10);
	}
	return -1;
}