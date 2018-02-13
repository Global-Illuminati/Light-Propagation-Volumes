
struct vec3 {
	union {
		struct {
			float x, y, z;
		};
		float values[3];
	};
};

vec3 operator -(vec3 a, vec3 b) {
	return{ a.x - b.x,a.y - b.y ,a.z - b.z };
}
vec3 operator +(vec3 a, vec3 b) {
	return{ a.x + b.x,a.y + b.y ,a.z + b.z };
}
vec3 operator /(vec3 a, vec3 b) {
	return{ a.x / b.x,a.y / b.y ,a.z / b.z };
}

vec3 operator /(vec3 a, float f) {
	return{ a.x / f,a.y / f ,a.z / f };
}
vec3 operator *(vec3 a, float f) {
	return{ a.x * f,a.y * f ,a.z * f };
}

struct ivec3 {
	int x, y, z;
};
vec3 operator *(ivec3 a, vec3 b) {
	return{ a.x * b.x,a.y * b.y ,a.z * b.z };
}

ivec3 operator +(ivec3 a, ivec3 b) {
	return{ a.x + b.x,a.y + b.y ,a.z + b.z };
}

ivec3 operator -(ivec3 a, ivec3 b) {
	return{ a.x - b.x,a.y - b.y ,a.z - b.z };
}

struct AABB {
	vec3 min, max;
};
struct iAABB {
	ivec3 min, max;
};
ivec3 floor(vec3 v) {
	return{ (int)v.x,(int)v.y ,(int)v.z };
}
ivec3 ceil(vec3 v) {
	return{ (int)ceil(v.x),(int)ceil(v.y) ,(int)ceil(v.z) };
}
vec3 max(vec3 a, vec3 b) {
	return{ max(a.x,b.x),max(a.y,b.y) ,max(a.z,b.z) };
}
vec3 min(vec3 a, vec3 b) {
	return{ min(a.x,b.x),min(a.y,b.y) ,min(a.z,b.z) };
}

ivec3 max(ivec3 a, ivec3 b) {
	return{ max(a.x,b.x),max(a.y,b.y) ,max(a.z,b.z) };
}
ivec3 min(ivec3 a, ivec3 b) {
	return{ min(a.x,b.x),min(a.y,b.y) ,min(a.z,b.z) };
}

#define VOXEL_RES 512
struct VoxelScene {
	uint8_t voxels[VOXEL_RES][VOXEL_RES][VOXEL_RES];
	int voxel_res;
	AABB scene_bounds;
};


vec3 cross(vec3 a, vec3 b) {
	float x = a.y * b.z - a.z * b.y;
	float y = a.z * b.x - a.x * b.z;
	float z = a.x * b.y - a.y * b.x;
	return{ x,y,z };
}

float dot(vec3 a, vec3 b) {
	return a.x*b.x + a.y*b.y + a.z*b.z;
}

struct Mesh {
	vec3 *verts;
	int num_verts;
	int *indices;
	int num_indices;
};

struct Interval {
	float min, max;
};

struct Triangle {
	union {
		struct {
			vec3 a, b, c;
		};
		vec3 points[3];
	};

};

#include <limits>
AABB get_scene_bounds(Mesh mesh) {

	AABB ret;
	ret.min = { FLT_MAX, FLT_MAX ,FLT_MAX };
	ret.max = { -FLT_MAX, -FLT_MAX, -FLT_MAX };

	for (int i = 0; i < mesh.num_indices; i++) {
		vec3 v = mesh.verts[mesh.indices[i]];
		ret.min = min(v, ret.min);
		ret.max = max(v, ret.max);
	}
	
	vec3 size = ret.max - ret.min;
	return ret;
}

AABB aabb_from_triangle(Triangle t) {
	AABB ret;
	ret.max = max(max(t.a, t.b), t.c);
	ret.min = min(min(t.a, t.b), t.c);
	return ret;
}

iAABB transform_to_voxelspace(AABB bounding_box, VoxelScene *data) {
	vec3 voxel_scene_size = data->scene_bounds.max - data->scene_bounds.min;
	iAABB ret;
	ret.min = floor((bounding_box.min - data->scene_bounds.min) / voxel_scene_size  * data->voxel_res);
	ret.max = ceil((bounding_box.max - data->scene_bounds.min) / voxel_scene_size  * data->voxel_res);

	ret.min = max({ 0,0,0 }, ret.min);
	ret.max = min({ data->voxel_res,data->voxel_res,data->voxel_res }, ret.max);
	return ret;
}

#include "tri_aabb_intersection.h"
bool is_colliding(ivec3 voxel, VoxelScene *scene, Triangle triangle) {
	vec3 voxel_scene_size = scene->scene_bounds.max - scene->scene_bounds.min;
	vec3 voxel_size = voxel_scene_size / scene->voxel_res;

	vec3 center = voxel*voxel_size + scene->scene_bounds.min + voxel_size/2.0;
	vec3 half_voxel_size = voxel_size*0.5;
	return TriBoxOverlap(center.values, half_voxel_size.values, &triangle.a.values);
}

void voxelize_scene(Mesh mesh, VoxelScene *data) {
	data->scene_bounds = get_scene_bounds(mesh);
	data->voxel_res = VOXEL_RES;

	
	int num_set_voxels = 0;
	for (int i = 0; i < mesh.num_indices / 3; i++) {
		vec3 a = mesh.verts[mesh.indices[i * 3 + 0]];
		vec3 b = mesh.verts[mesh.indices[i * 3 + 1]];
		vec3 c = mesh.verts[mesh.indices[i * 3 + 2]];

		Triangle t = { a,b,c };

		AABB bounds = aabb_from_triangle(t);
		iAABB voxel_bounds = transform_to_voxelspace(bounds, data);

		ivec3 min = voxel_bounds.min;
		ivec3 max = voxel_bounds.max;
		for (int x = min.x; x < max.x; x++) for (int y = min.y; y < max.y; y++) for (int z = min.z; z < max.z; z++) {
			if (data->voxels[x][y][z])continue;
			ivec3 voxel = { x,y,z };
			if (is_colliding(voxel,data,t)) {
				data->voxels[x][y][z] = 1;
				++num_set_voxels;
			}
		}
	}
	printf("%d\n", num_set_voxels);
}

#include <vector>

void maybe_enqueue_unchecked(VoxelScene *scene, std::vector<ivec3> &to_process, ivec3 value) {
	if (scene->voxels[value.x][value.y][value.z]) return;
	scene->voxels[value.x][value.y][value.z] = 2;
	to_process.push_back(value);
}
// returns true if we're on the surface. ( to be used for candidate probe points..
bool maybe_enqueue(VoxelScene *scene, std::vector<ivec3> &to_process, ivec3 value) {
	if (value.x < 0 || value.x >= scene->voxel_res) return false;
	if (value.y < 0 || value.y >= scene->voxel_res) return false;
	if (value.z < 0 || value.z >= scene->voxel_res) return false;
	if (scene->voxels[value.x][value.y][value.z] == 2)  return false;
	if (scene->voxels[value.x][value.y][value.z] == 1)  return true;
	scene->voxels[value.x][value.y][value.z] = 2;
	to_process.push_back(value);
	return false;
}

void flood_fill_voxel_scene(VoxelScene *scene, std::vector<ivec3> &candidate_probes) {

	std::vector<ivec3> to_process;
	to_process.reserve(scene->voxel_res*scene->voxel_res * 6);
	int process_index = 0;

	
	// push all faces of voxel scene as start verts
	for (int x = 0; x < scene->voxel_res; x++) {
		for (int y = 0; y < scene->voxel_res; y++) {
			maybe_enqueue_unchecked(scene, to_process, { x,y, 0 });
			maybe_enqueue_unchecked(scene, to_process, { x,y, scene->voxel_res - 1 });
			maybe_enqueue_unchecked(scene, to_process, { 0, x,y });
			maybe_enqueue_unchecked(scene, to_process, { scene->voxel_res - 1,x,y });
			maybe_enqueue_unchecked(scene, to_process, { x,0, y });
			maybe_enqueue_unchecked(scene, to_process, { x,scene->voxel_res - 1,y });
		}
	}


	ivec3 neighbours[6] = { { 1,0,0 },{ -1,0,0 },
							{ 0,1,0 },{ 0,-1,0 },
							{ 0,0,1 },{ 0,0,-1 }};

	while (to_process.size() > 0) {
		ivec3 current = to_process.back();
		to_process.pop_back();
		bool add_to_probes = false;
		for (int i = 0; i < 6; i++) {
			add_to_probes |= maybe_enqueue(scene, to_process, current + neighbours[i]);
		}
		if (add_to_probes) candidate_probes.push_back(current);
	}
	printf("num candidate candidate_probes = %d\n", candidate_probes.size());
}

void write_voxel_data(VoxelScene *data, char *file_path) {
	FILE *f = fopen(file_path, "w");
	for (int x = 0; x < data->voxel_res; x++) for (int y = 0; y < data->voxel_res; y++) for (int z = 0; z < data->voxel_res; z++) {
		if (data->voxels[x][y][z] == 1) fprintf(f, "%d %d %d\n", x, y, z);
	}
	fclose(f);
}
