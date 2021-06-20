const Contents = ["home", "about", "works"]
var lang;
var content;

function init() {
	lang = 'en';
	content = 'home';
	
	showElementsOfClass(['en'], false);
	showElementsOfClass(['jp'], false);
	for (i = 0; i < Contents.length; i++)
			showElementsOfClass([Contents[i]], false);
	showElementsOfClass([lang, content], true);
	showElementsOfClass([lang, 'all'], true);

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
	
	for (i = 0; i < homeLinks.length; i++)
		homeLinks[i].onclick = function () {
			changeContent("home"); };
	for (i = 0; i < worksLinks.length; i++)
		worksLinks[i].onclick = function () {
			changeContent("works"); };
	for (i = 0; i < aboutLinks.length; i++)
		aboutLinks[i].onclick = function () {
			changeContent("about"); };

	document.getElementById("wrapper").style.setProperty('display', 'block', 'important'); 
}

function changeLang(newLang) {
	showElementsOfClass([lang, content], false);
	showElementsOfClass([lang, 'all'], false);
	showElementsOfClass([newLang, content], true);
	showElementsOfClass([newLang, 'all'], true);
	lang = newLang;
}

function changeContent(newContent) {
	showElementsOfClass([lang, content], false);
	showElementsOfClass([lang, newContent], true);
	content = newContent;
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
	const themeToggleLight = document.getElementById("light-theme");
	const themeToggleDark = document.getElementById("dark-theme");
	if (document.body.classList.toggle("light")) {
		themeToggleLight.style.display = 'none';
		themeToggleDark.style.display = 'block';
	} else {
		themeToggleLight.style.display = 'block';
		themeToggleDark.style.display = 'none';
	}
}

init();