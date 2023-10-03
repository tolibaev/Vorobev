import * as nodePath from "path";
const rootFolder = nodePath.basename(nodePath.resolve());

const buildFolder = `./docs`;
const srcFolder = `./src`;

export const path = {
   build: {
      files: `${buildFolder}/files/`,
      html: `${buildFolder}/`,
      css: `${buildFolder}/css/`,
      js: `${buildFolder}/js/`,
      images: `${buildFolder}/img/`,
      fonts: `${buildFolder}/fonts/`,
   },
   src: {
      files: `${srcFolder}/files/**/*.*`,
      html: `${srcFolder}/*.html`,
      scss: `${srcFolder}/scss/*.scss`,
      js: `${srcFolder}/js/*.js`,
      noSvg: `${srcFolder}/img/*.{jpg, jpeg, png}`,
      images: `${srcFolder}/img/**/*.*`,
   },
   watch: {
      files: `${srcFolder}/files/**/*.*`,
      html: `${srcFolder}/**/*.html`,
      scss: `${srcFolder}/scss/**/*.scss`,
      js: `${srcFolder}/js/**/*.js`,
      images: `${srcFolder}/img/**/*.*`,
   },
   clean: buildFolder,
   srcFolder: srcFolder,
   rootFolder: rootFolder,
}