import * as THREE from './resources/three/build/three.module.js'
import {OrbitControls} from './resources/three/examples/jsm/controls/OrbitControls.js';

const canvas = document.querySelector('#blocktest');
const renderer = new THREE.WebGLRenderer({canvas});
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera( 45, window.innerWidth / window.innerHeight, 1, 2000 );
camera.position.set(0, 80, 50);

const controls = new OrbitControls( camera, canvas );
controls.enableDamping = false;
controls.enablePan = true;
controls.minDistance = 1.2;
controls.maxDistance = 1000;
controls.target = new THREE.Vector3(0,0,0);
controls.update();

addMesh({
	p1: { x: -30, y: -30 },
	p2: { x:  30, y:  30 }
}, 'white', -1);

const GAP_SIZE = 5;
const CUT_COUNT = rand(2, 10);
const GAP_CHANCE = 0.1;
const PAD_CHANCE = 0.3;
const PAD_SIZE = 10;

const squares = [];

const initialSquare = {
	p1: { x: -30, y: -30 },
	p2: { x:  30, y:  30 } };

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

for (let i = 0; i < CUT_COUNT; i++) {
	const gap = randFloat(0, 1) < GAP_CHANCE ? GAP_SIZE : 0;
	const target = Math.floor(squares.length * Math.abs(Math.random() - Math.random()));
	const cutDirection = Math.floor(heightByWidth(squares[target][1])) ? 'y' : 'x';
	const newSquares = cut(target, randFloat(0.3, 0.6), cutDirection, gap).map(s=>[area(s), s]);
	squares.splice(target, 1);
	for (const square of newSquares) {
		insertSquare(square);
	}
}

console.log(squares);
for (const square of squares) {
	addMesh(square[1], new THREE.Color(`hsl(${randFloat(0, 255)}, ${rand(0, 100)}%, ${rand(0, 80)}%)`));
}

document.addEventListener( 'keydown', onDocumentKeyDown, false );

render();

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

function addMesh({ p1, p2 }, colorTex, z = 0) {

	const vertices = [];
	vertices.push(p1.x, z, p1.y);
	vertices.push(p1.x, z, p2.y);
	vertices.push(p2.x, z, p2.y);
	vertices.push(p2.x, z, p1.y);

	const indices = [];
	indices.push(0, 1, 2);
	indices.push(2, 3, 0);

	const geometry = new THREE.BufferGeometry();
	geometry.setIndex( indices );
	geometry.setAttribute( 'position', new THREE.Float32BufferAttribute( vertices, 3 ) );	

	const material = new THREE.MeshBasicMaterial( { color: colorTex } )

	const mesh = new THREE.Mesh(geometry, material);

	scene.add(mesh);
}

function area(square) {
	return (square.p2.x - square.p1.x) * (square.p2.y - square.p1.y);
}

function heightByWidth(square) {
	return (square.p2.y - square.p1.y) / (square.p2.x - square.p1.x);
}

function rand(min, max) {	
	return Math.floor(randFloat(min, max + 1));
}

function randFloat(min, max) {	
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

function render() {

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
	camera.fov = 100;
}