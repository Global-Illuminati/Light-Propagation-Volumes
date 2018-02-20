#include "voxelizer.hpp"
#include <algorithm>
#include <vector>
#include <set>
#include <cmath>
#include <numeric>
#include <assert.h>

struct ProbeElement {
	vec3 position;
	std::set<int> affected_probes_indices; // Indices in the probe_elements list of the probes within this probe's radius
	float density;
	int sort_position; // Position in the denseness sorting, e.g. 3 for the third least dense probe
};

struct ProbeElementIndexComparator {
	std::vector<ProbeElement> *probe_elements;
	bool operator()(int index1, int index2) {
		return (*probe_elements)[index1].density < (*probe_elements)[index2].density;
	}
};

float w(float t) {
	return 2 * std::pow(t, 3) - 3 * std::pow(t, 2) + 1;
}

float wi(vec3 x, vec3 probe, float radius) {
	return w((x - probe).norm() / radius);
}

void assert_sorted(std::vector<ProbeElement> &probe_elements, std::vector<int> &density_sorting) {
	ProbeElementIndexComparator probe_element_index_comparator = { &probe_elements };
	bool sorted = std::is_sorted(density_sorting.begin(), density_sorting.end(), probe_element_index_comparator);
	assert(sorted);
}

void init_probe_elements(std::vector<ProbeElement> &probe_elements, const std::vector<vec3> probes, float radius) {
	for (int i = 0; i < probes.size(); i++) {
		probe_elements[i].position = probes[i];
		probe_elements[i].density = 0.0f;
	}
	
	for (int i = 0; i < probe_elements.size(); i++) {
		probe_elements[i].density += 1.0f; //since wi(probe_elements[i].position, probe_elements[i].position, radius) == 1
		for (int j = i + 1; j < probe_elements.size(); j++) {
			if ((probe_elements[i].position - probe_elements[j].position).norm() < radius) {
				float added_density = wi(probe_elements[i].position, probe_elements[j].position, radius);
				probe_elements[i].density += added_density;
				probe_elements[j].density += added_density;
				probe_elements[i].affected_probes_indices.insert(j);
				probe_elements[j].affected_probes_indices.insert(i);
			}
		}
	}
}

void set_probe_elements_sort_positions(std::vector<ProbeElement> &probe_elements, std::vector<int> density_sorting) {
	for (int i = 0; i < density_sorting.size(); i++) {
		probe_elements[density_sorting[i]].sort_position = i;
	}
}

/**
  Assuming that the density_sorting is correct, this function removes the densest probe from the sorting,
  recalculates the affected densities and makes sure the density_sorting is again in a sorted state.
*/
void remove_densest_probe(std::vector<ProbeElement> &probe_elements, std::vector<int> &density_sorting, float rho_probes) {
	int removed_probe_index = density_sorting.back();
	density_sorting.pop_back(); 
	ProbeElement removed_probe = probe_elements[removed_probe_index];
	for (int probe_index : removed_probe.affected_probes_indices) {
		probe_elements[probe_index].affected_probes_indices.erase(removed_probe_index);
		probe_elements[probe_index].density -= wi(probe_elements[probe_index].position, removed_probe.position, rho_probes);
		float density = probe_elements[probe_index].density;
		// Since the density decreased, bubble down until the correct place in the sorting is found again
		int sort_position = probe_elements[probe_index].sort_position;
		while (sort_position > 0 && density < probe_elements[density_sorting[sort_position - 1]].density) {
			int temp = density_sorting[sort_position - 1];
			density_sorting[sort_position - 1] = probe_index;
			density_sorting[sort_position] = temp;
			probe_elements[density_sorting[sort_position]].sort_position = sort_position;
			sort_position--;
		}
		probe_elements[probe_index].sort_position = sort_position;
		//assert_sorted(probe_elements, density_sorting);
	}
}


/**
  "To avoid introducing additional parameters,
  we set the target probe count to the
  number of points in a regular grid
  that covers the scene with
  grid spacing set to rho_probes."
*/
int calculate_target_probe_count(VoxelScene *scene, float rho_probes) {
	vec3 dimensions = scene->scene_bounds.max - scene->scene_bounds.min;
	return int(ceil(pow((1 + pow(dimensions[0] * dimensions[1] * dimensions[2], 1.0f / 3.0f) / rho_probes), 3.0f)));
}


void reduce_probes(std::vector<vec3> &probes, VoxelScene *scene, float rho_probes) {
	
	std::vector<ProbeElement> probe_elements(probes.size()); // This does not change after init_probe_elements,
															 // so indices into this vector don't need to be updated
														     // when probes are removed from the density_sorting
	ProbeElementIndexComparator probe_element_index_comparator = { &probe_elements };
	std::vector<int> density_sorting(probes.size()); // The indices of the probes in the probe_elements list
													 // sorted according to the density of probe_elements[index]
	std::iota(std::begin(density_sorting), std::end(density_sorting), 0);
	int target_probe_count = calculate_target_probe_count(scene, rho_probes);

	printf("\nrho_probes = %f\n", rho_probes);
	printf("target_probe_count = %d\n", target_probe_count);

	

	// 1. For each probe, store the other probes that are within the radius rho_probes
	init_probe_elements(probe_elements, probes, rho_probes);

	// 2. Perform an initial sort by density
	sort(density_sorting.begin(), density_sorting.end(), probe_element_index_comparator);
	set_probe_elements_sort_positions(probe_elements, density_sorting);

	printf("Beginning pruning...\n");

	// 3. Now, iteratively remove the probe with the highest density until the desired number of probes is reached
	while (density_sorting.size() > target_probe_count) {
		remove_densest_probe(probe_elements, density_sorting, rho_probes);
	}

	// Modify the original probes vector to contain only the selected probes
	probes.clear();
	for (int i = 0; i < density_sorting.size(); i++) {
		vec3 probe = probe_elements[density_sorting[i]].position;
		probes.push_back(probe);
		//printf("selected probe: (%f, %f, %f)\n", probe[0], probe[1], probe[2]);
	}

	printf("probes.size() = %d\n", probes.size());
}

void write_probe_data(const std::vector<vec3> &probes, char *file_path) {
	FILE *f = fopen(file_path, "w");
	for (const auto &probe : probes) {
		fprintf(f, "%f %f %f\n", probe[0], probe[1], probe[2]);
	}
	fclose(f);
}