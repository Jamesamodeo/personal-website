const Contents = ["home", "about", "works"]
var lang;
var content;

function init() {	
	lang = 'en';
	content = 'home';
	page = 'default';
	
	showElementsOfClass(['en'], false);
	showElementsOfClass(['jp'], false);
	for (i = 0; i < Contents.length; i++)
		showElementsOfClass([Contents[i]], false);
	showElementsOfClass([lang, content], true);
	showElementsOfClass([lang, 'all'], true);
	showElementsOfClass(["cacheintheclouds"], false);

	const themeToggleLight = document.getElementById("light-theme");
	const themeToggleDark = document.getElementById("dark-theme");
	themeToggleLight.onclick = toggleTheme;
	themeToggleDark.onclick = toggleTheme;
	
	const en = document.getElementById("en-lang");
    const jp = document.getElementById("jp-lang");
	en.style.fontWeight = 'bold';
	
	en.onclick = function () {
		changeLang('en');
		document.getElementById("en-lang").style.fontWeight = 'bold';
		document.getElementById("jp-lang").style.fontWeight = 'normal';
	};
	jp.onclick = function () {
		changeLang('jp');
		document.getElementById("jp-lang").style.fontWeight = 'bold';
		document.getElementById("en-lang").style.fontWeight = 'normal';
	};

	const homeLinks = document.getElementsByClassName("to-home");
    const worksLinks = document.getElementsByClassName("to-works");
	const aboutLinks = document.getElementsByClassName("to-about");
	const citcLinks = document.getElementsByClassName("to-citc");
	
	for (i = 0; i < homeLinks.length; i++)
		homeLinks[i].onclick = function () {
			changeContent("home"); };
	for (i = 0; i < worksLinks.length; i++)
		worksLinks[i].onclick = function () {
			changeContent("works"); };
	for (i = 0; i < aboutLinks.length; i++)
		aboutLinks[i].onclick = function () {
			changeContent("about"); };
	for (i = 0; i < citcLinks.length; i++)
		citcLinks[i].onclick = function () {
			showElementsOfClass(["cacheintheclouds"], true);
			showElementsOfClass(["default"], false); };

	const returnHomeLink = document.getElementById("return-home-button");
	returnHomeLink.onclick = function() {
		showElementsOfClass(["cacheintheclouds"], false);
		showElementsOfClass(["default"], true);
	};

	const hash = new URL(document.URL).hash;
	if (hash == "#cacheintheclouds") {
		showElementsOfClass(["cacheintheclouds"], true);
		showElementsOfClass(["default"], false);
	}

	document.getElementById("wrapper").style.setProperty('display', 'block', 'important'); 
}

function changeLang(newLang) {
	showElementsOfClass([lang], false);
	showElementsOfClass([newLang, content], true);
	showElementsOfClass([newLang, 'all'], true);
	lang = newLang;
}

function changeContent(newContent) {
	showElementsOfClass([content], false);
	showElementsOfClass([lang, newContent], true);
	content = newContent;
}

function changePage(newPage) {
	console.log("Changing page to", newPage);
	showElementsOfClass([page], false);
	showElementsOfClass([lang, newPage], true);
	page = newPage;
}

function showElementsOfClass(classnames, show) {
	classname = classnames.join(' ');
	const display = show ? 'block' : 'none';
	const toElements = document.getElementsByClassName(classname);
	for (j = 0; j < toElements.length; j++) {
		toElements[j].style.display = display;
	}
}

function toggleTheme() {
	document.body.classList.toggle("light");
	toggleElementsById('light-theme', 'dark-theme');
}

function toggleElementsById(id1, id2) {
	const element1 = document.getElementById(id1);
	const element2 = document.getElementById(id2);
	if (element1.style.display == 'none') {
		element1.style.display = 'block';
		element2.style.display = 'none';
	} else {
		element1.style.display = 'none';
		element2.style.display = 'block';
	}
}

init();