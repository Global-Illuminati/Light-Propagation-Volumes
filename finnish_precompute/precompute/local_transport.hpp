
const int num_sh_samples = 64; // this should be approximatly the same as the number of sh coeffs I think. probably a couple of x larger..
static vec3 sample_points[num_sh_samples][num_sh_samples];

float pi = 3.1415;

// @PERF
// for now just uniformly along full sphere.
// in future probably cosine mapping on hemisphere in normal direction
// now we'll just throw away half the points and spend a whole lot of time with points that doens't matter
// but postpone. 
// also note that if we were no longer using uniform sampling we'd need to change the sum a bit.
// see importance sampling with regards to montecarlo integration

void generate_sample_points() {
	float inv_num_samples = 1.0 / num_sh_samples;
	for (int i = 0; i < num_sh_samples; i++) {
		float phi = i * inv_num_samples * pi;
		for (int j = 0; j < num_sh_samples; j++) {
			float theta = i * inv_num_samples * pi*2;
			float st = sin(theta);
			sample_points[i][j] = vec3(st * cos(phi), st * sin(phi), cos(theta));
		}
	}
}

// is 15 enough? on average 10 or what ever
const int num_probes_per_rec = 15;


struct ReceiverData {
	vec3 position;
	vec3 normal;

	struct Probe{
		float weight;
		vec3 position;
		float sh_coeffs[64];
	} visible_probes[num_probes_per_rec];
	int num_visible_probes;
};


// I'm like almost certain this is going to be the hot loop right here lol
void compute_alpha(std::vector<Receiver> recs, std::vector<vec3> probe_locations, Mesh mesh, float radius) {
	generate_sample_points();
	float inv_radius = 1.0 / radius;
	std::vector<ReceiverData *> receivers;
	receivers.reserve(recs.size());
	// initialize data:
	for (Receiver receiver : recs) {
		ReceiverData *rec_data = (ReceiverData *)calloc(1,sizeof(ReceiverData));
		rec_data->normal = receiver.norm;
		rec_data->position = receiver.pos;
		for (vec3 probe: probe_locations) {
			float dist = (probe - rec_data->position).norm();
			if (dist<radius) {
				rec_data->visible_probes[rec_data->num_visible_probes].position = probe;
				rec_data->visible_probes[rec_data->num_visible_probes].weight = w(inv_radius*dist);

				++rec_data->num_visible_probes;
				if (rec_data->num_visible_probes == num_probes_per_rec) {
					printf("overflowing num_visible_per_rec probes...\n");
					break;
				}
			}
		}
		receivers.push_back(rec_data);
	}

	// lol six nested for loops 
	// I'm calling hot spot..
	// inner loop will execute approx: 100000*100*100*15*64 = 960 000 000 000 times.....
	// .................................................................................
	// .................................................................................
	// ...................................really?.......................................
	// .................................................................................
	// .................................................................................
	// oh and thers a loop over all tris in the see_same_point func
	// 100000*100*100*15*150000 =  2.25 * 10^15.................
	printf("number of receivers: %d\n", receivers.size());
	int num_processed_receivers = 0;
	for (ReceiverData *receiver : receivers) {
		for (int i = 0; i < num_sh_samples; i++) {
			for (int j = 0; j < num_sh_samples; j++) {
				vec3 dir = sample_points[i][j];
				Ray ray = { receiver->position,dir };
				float c = max(receiver->normal.dot(dir), 0.0f); // @remove max if only on hemisphere!
				float denom = 0;
				vec3 psi_dir[num_probes_per_rec];
				float func_value[num_probes_per_rec];

				for (int p = 0; p < receiver->num_visible_probes; p++) {
					vec3 probe_pos = receiver->visible_probes[p].position;
					// half of this can be outside of p. (ie first trace. 1.7x speedup maybe) 
					bool v = see_same_point(ray, probe_pos, mesh, &psi_dir[p]);
					float w = receiver->visible_probes[p].weight;
					float res = v * w * c; 
					func_value[p] = res;
					denom += res;
				}

				// I feel like we're missing a term here.
				// we assume that the surface that we hit is oriented equally towards p and s right?
				// ie. we treat it as a point light. which is probably not accurate.
				// is this where beta comes in?

				if (denom) {
					float inv_denom = 1.0f / denom;
					for (int p = 0; p < receiver->num_visible_probes; p++) {
						for (int l = 0; l <= 7; l++) {
							for (int m = -l; m <= l; m++) {
								auto d_dir = Eigen::Vector3d(psi_dir[p].x(), psi_dir[p].y(), psi_dir[p].z());
								receiver->visible_probes->sh_coeffs[sh::GetIndex(l, m)] 
									+= func_value[p] * inv_denom * sh::EvalSH(l, m, d_dir.normalized()); 
							}
						}
					}
				}
			}
			printf("processed %f\% of the samples.\n", (i) / (64.0));
		}
		++num_processed_receivers;
		printf("processed %f\% of the receivers.", num_processed_receivers*100.0 / receivers.size());
	}
}





