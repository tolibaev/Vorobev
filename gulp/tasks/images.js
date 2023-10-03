import webp from 'gulp-webp';
import imagemin from 'gulp-imagemin';
import avif from 'gulp-avif';

export const images = () => {
	return app.gulp.src(app.path.src.images)
		.pipe(app.plugins.plumber(
			app.plugins.notify.onError({
				title: "IMAGES",
				message: "Error: <%= error.message %>"
			}))
		)
		// .pipe(
		//    app.plugins.if(
		//       app.isBuild,
		//       app.plugins.newer(app.path.build.images)
		//    )
		// )
		// .pipe(
		//    app.plugins.if(
		//       app.isBuild,
		//       app.gulp.src(app.path.src.noSvg)
		//    )
		// )
		// .pipe(
		//    app.plugins.if(
		//       app.isBuild,
		//       avif({ quality: 50 })
		//    )
		// )
		// .pipe(
		//    app.plugins.if(
		//       app.isBuild,
		//       app.gulp.dest(app.path.build.images)
		//    )
		// )
		// .pipe(
		//    app.plugins.if(
		//       app.isBuild,
		//       app.gulp.src(app.path.src.images)
		//    )
		// )
		// .pipe(
		//    app.plugins.if(
		//       app.isBuild,
		//       app.plugins.newer(app.path.build.images)
		//    )
		// )
		// .pipe(
		//    app.plugins.if(
		//       app.isBuild,
		//       webp()
		//    )
		// )
		// .pipe(
		//    app.plugins.if(
		//       app.isBuild,
		//       app.gulp.dest(app.path.build.images)
		//    )
		// )
		.pipe(
			app.plugins.if(
				app.isBuild,
				app.gulp.src(app.path.src.images)
			)
		)
		.pipe(app.plugins.newer(app.path.build.images))
		.pipe(
			app.plugins.if(
				app.isBuild,
				imagemin({})
			)
		)
		.pipe(app.gulp.dest(app.path.build.images))
		.pipe(app.plugins.browserSync.stream())
}
