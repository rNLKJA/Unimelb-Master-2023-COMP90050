# Unimelb-Master-2023-COMP90050

- [Unimelb-Master-2023-COMP90050](#unimelb-master-2023-comp90050)
  - [Administration Information](#administration-information)
    - [Reference books:](#reference-books)
    - [Subject Overview:](#subject-overview)
    - [Learning outcomes:](#learning-outcomes)
    - [Assessment:](#assessment)
    - [Staff information](#staff-information)
  - [Subject Introduction](#subject-introduction)
  - [Core Concepts of Database Management System](#core-concepts-of-database-management-system)
    - [Efficiency/speed](#efficiencyspeed)
    - [Effectiveness](#effectiveness)
    - [Security \& Reliability](#security--reliability)
  - [Basic Hardware of a classifical disk](#basic-hardware-of-a-classifical-disk)
    - [Disk Access Time for HDD](#disk-access-time-for-hdd)
  - [SSD (Solid State Drive/Solid State Disk)](#ssd-solid-state-drivesolid-state-disk)
  - [Moore's Law](#moores-law)
  - [Joy's Law](#joys-law)
  - [Storage Metrics](#storage-metrics)
  - [Memory Hierarchy](#memory-hierarchy)
    - [Data Reading Flow](#data-reading-flow)
    - [Data Transferred from HDD](#data-transferred-from-hdd)
  - [Communication Costs](#communication-costs)
  - [Multi-Core System](#multi-core-system)
  - [Types of Database Systems](#types-of-database-systems)
    - [Simple File System](#simple-file-system)
    - [RDBS (Relational Database System)](#rdbs-relational-database-system)
    - [Object-Oriented Database System](#object-oriented-database-system)
    - [NoSQL Database System](#nosql-database-system)
      - [Types of NoSQL Database](#types-of-nosql-database)
        - [Key-value store: Tokyo Cabinet, Redis, Voldemort, Oracle NoSQL Database, Amazon DynamoDB, Riak, Apache Cassandra, etc.](#key-value-store-tokyo-cabinet-redis-voldemort-oracle-nosql-database-amazon-dynamodb-riak-apache-cassandra-etc)
        - [Document-Based: MongoDB, CouchDB, OrientDB, RavenDB, etc.](#document-based-mongodb-couchdb-orientdb-ravendb-etc)
        - [Column-Based: BigTable, Apache Cassandra, HBase, Hypertable, etc.](#column-based-bigtable-apache-cassandra-hbase-hypertable-etc)
        - [Graph-Based: Neo4J, InfiniteGraph, Flock DB, etc.](#graph-based-neo4j-infinitegraph-flock-db-etc)
        - [Some other DB systems - Deductive database systems (DDBS)](#some-other-db-systems---deductive-database-systems-ddbs)
  - [Database Architecture](#database-architecture)
    - [Centralised](#centralised)
    - [Distributed](#distributed)
    - [WWW](#www)
    - [Grid](#grid)
    - [P2P](#p2p)
    - [Cloud](#cloud)
  - [Fault Tolerance](#fault-tolerance)
  - [A system's lifecycle](#a-systems-lifecycle)
  - [Fault tolerance by RAID](#fault-tolerance-by-raid)
    - [RAID o (Block Level Stripping)](#raid-o-block-level-stripping)
    - [RAID 1 (mirroing)](#raid-1-mirroing)
    - [RAID 2 (Bit level Striping)](#raid-2-bit-level-striping)
    - [RAID 3 (Byte level Striping)](#raid-3-byte-level-striping)
    - [RAID 4 (Block level level striping)](#raid-4-block-level-level-striping)
    - [RAID 5 with 3 disks (Block level striping)](#raid-5-with-3-disks-block-level-striping)
    - [RAID 6 (Block level level striping)](#raid-6-block-level-level-striping)
  - [Fault Tolerance by Voting](#fault-tolerance-by-voting)
    - [Fault Tolerance for disks](#fault-tolerance-for-disks)
  - [Availability of Failvote systems](#availability-of-failvote-systems)
  - [Fault Tolerance with Repair](#fault-tolerance-with-repair)
  - [Fault Tolerance with Supermodule](#fault-tolerance-with-supermodule)
  - [Transaction Models](#transaction-models)
    - [Duplex Write](#duplex-write)
    - [Logged Write](#logged-write)
  - [Cyclic Redeundancy Check (CRC) Generation](#cyclic-redeundancy-check-crc-generation)
    - [How to determine the CRC polynomial](#how-to-determine-the-crc-polynomial)
    - [Checking validity with CRC](#checking-validity-with-crc)

## Administration Information

2023 Winter COMP90050 Advanced Database

### Reference books:

1. Transaction Processing. Jim Gray, Andreas Reuter, Morgan Kaufmann, 1992.
2. Database system concepts. Abraham Silberschatz, Henry F. Korth, S. Sudarshan, McGraw-Hill, 2011.

### Subject Overview:

- Handbook: https://handbook.unimelb.edu.au/2023/subjects/comp90050

### Learning outcomes:

1. Understanding issues related to performance and reliability in building applications involving large-scale database systems.
2. Understand Database Technologies used in large-scale applications such as Google search Engines.
3. Understand the concepts and technologies underpinning new forms of Web data.
4. Deep knowledge of transaction processing and recovery from failures and concepts employed in modern database systems.

### Assessment:

- Five quizzes 2% each during the semester.
- A group project (40%), GitHub:
  1. Form a group of 4 students by 2 July, 2023, 11:59 pm
  2. Pick a topic of your interest
- A final exam (50%)

### Staff information

**Lecturer**

- Dr. Farhana Choudhury: farhana.choudhury@unimelb.edu.au

**Head Tutor**

- Dr. Tawfiq Islam: tawfiqqul.islam@unimelb.edu.au

**Tutors**

- Ahmad Asgharian Rezaei: a.asghariyanrezayi@gmail.com
- Lakmal Muthugama: lakmal.muthugama@unimelb.edu.au
- Daniel Gong: d.gong@unimelb.edu.au
- David alexander Tedjopurnomo: davidtedjopurnomo@gmail.com

## Subject Introduction

> **Database**: a large, integrated, structured collection of data.

> **Database Management System (DBMS)**: a software package designed to store and manage and facilitate access to databases.

A database system should provide:

- Ability to retrieve and process the data _effectively and efficiently_.
- _Secure and reliable_ storage of data.

## Core Concepts of Database Management System

![](images/2023-06-26-14-47-52.png)

> **Database performance metrics** measured by effectiveness, efficientness security and reliability.

### Efficiency/speed

- Hardware
  - Disks and I/O bandwidth
  - Main memory
  - Type of architecture
- Software/DB tuning
  - Types of DB
  - Indexing
  - Query optimization

### Effectiveness

- Concurrent users: users reading and writing over the same data.
- Transactions: Required tasks are all done together.

### Security & Reliability

- Crash recovery
- Fault tolerance
- Data duplication

## Basic Hardware of a classifical disk

![](images/2023-06-26-14-50-39.png)

| Conponent    | Description                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| Platter      | a disk is made up of one or more platters, which are circular plates coated on both sides with a magnetizable material. |
| Track        | a concentric circle on a platter/disk surface.                                                                          |
| Sector       | a pie-shaped wedge on a platter/disk surface.                                                                           |
| Track Sector | a sector on a track.                                                                                                    |
| Head         | a device that reads and writes data on a platter/disk surface.                                                          |
| Actuator Arm | a device that positions the head over the appropriate track.                                                            |
| Cluster      | a group of sectors.                                                                                                     |

- Track $\rightarrow$ Dividied into track sectors.
- Multiple track sectors $\rightarrow$ Cluster.
- Actuator arm reads/writes data on the disk.

**How Hard Drives Work**: https://www.youtube.com/watch?v=wteUW2sL7bc

**How SSDs Work**: https://www.youtube.com/watch?v=5Mh3o886qpg

> Supermagnetic effect: the effect of the head being able to read/write data on the disk.

### Disk Access Time for HDD

$\text{Disk access time}=\text{seek time} + \text{rotational time} + \cfrac{\text{transfer length}}{\text{bandwith}}$

> What is the Disk access time for a transfer size of 4KB, when average seek time is 12 ms, rotation delay is 4 ms, transfer rate is 4MB/sec?
>
> Given the parameters of the above question, we can calculate the disk access time as follows:
>
> - seek time = 12 ms
> - rotational time = 4 ms
> - transfer length = 4 kb
> - bandwidth = 4mb/sec = 4 \* 1024 kb / 1000 ms = 4.096 kb / ms
>   Substituting the values in the formula, we get:
>   $$
>   \begin{aligned}
>   \text{Disk access time} &=\text{seek time} + \text{rotational time} + \cfrac{\text{transfer length}}{\text{bandwith}} \\
>   &= 12 \text{ms} + 4 \text{ms} + (4\text{kb} / 4.096 \text{kb/ms}) \\
>   &= 16 \text{ms} + 0.976 \text{ms} \\
>   &= 16.976 \text{ms}
>   \end{aligned}
>   $$

- Seek time is the time required to position the actuator arm over the appropriate track.

## SSD (Solid State Drive/Solid State Disk)

- No moving parts like Hard Disk Drive (HDD).
- Silicon-based storage medium rather than magnetic.
- No seek/rotation latency
- No start-up times like HDD
- Runs siliently
- Random access of typically under 100 micro-seconds compared to 2000-3000 micro-seconds for HDD
- Relatively very expensive, thus did not dominate at all fronts yet
- Certain read/write limitations plagued it for years

> $\text{Disk Access Time} = \cfrac{\text{Transfer Length}}{\text{Band Width}}$

## Moore's Law

Moore's law indicates that memory chip capacity doubles every 18 months since 1970 and will continue to do so for the foreseeable future.

$$
\text{Memory Chip Capacity} = 2^{\cfrac{(\text{year} - 1970)^2}{3}}\text{ KB/chip}
$$

## Joy's Law

Joy's law for processors indicates that processor performance doubles every two years since 1984.

$$
\text{Processor Performance} = 2^{\cfrac{(\text{year} - 1984)}{2}}\text{ MIPS}
$$

## Storage Metrics

| Metric         | Value    |          |           | Bytes                             |
| -------------- | -------- | -------- | --------- | --------------------------------- |
| Byte           | $1024^0$ | $2^0$    | $10^0$    | 1                                 |
| Kilobyte (KB)  | $1024^1$ | $2^{10}$ | $10^3$    | 1,024                             |
| Megabyte (MB)  | $1024^2$ | $2^{20}$ | $10^6$    | 1,048,576                         |
| Gigabyte (GB)  | $1024^3$ | $2^{30}$ | $10^9$    | 1,073,741,824                     |
| Terabyte (TB)  | $1024^4$ | $2^{40}$ | $10^{12}$ | 1,099,511,627,776                 |
| Petabyte (PB)  | $1024^5$ | $2^{50}$ | $10^{15}$ | 1,125,899,906,842,624             |
| Exabyte (EB)   | $1024^6$ | $2^{60}$ | $10^{18}$ | 1,152,921,504,606,846,976         |
| Zettabyte (ZB) | $1024^7$ | $2^{70}$ | $10^{21}$ | 1,180,591,620,717,411,303,424     |
| Yottabyte (YB) | $1024^8$ | $2^{80}$ | $10^{24}$ | 1,208,925,819,614,629,174,706,176 |

## Memory Hierarchy

<img src="images/2023-06-26-15-09-50.png" width=400 />

### Data Reading Flow

- Hard Disk Drive (HDD) $\leftrightarrow$ Main Memory (RAM)
- L3 Cache $\leftrightarrow$ L2 Cache $\leftrightarrow$ L1 Cache $\leftrightarrow$ Processor $\leftrightarrow$ Registers.

- When power is turned off, data in RAM is lost.

$$
\text{Hit Ratio} = \cfrac{\text{References satisfied by Cache}}{\text{Total Reference}}
$$

Effective memory access time: $\text{EA} = \text{H}\times\text{C} + (1-\text{H})\times \text{M}$
where

- $\text{H}$ is the hit ratio,
- $\text{C}$ is the cache access time and
- $\text{M}$ is the memory access time.

> Example
> | Hit Ratio | Effective Access Time as Multiple of C, M = 100 C |
> | --------- | ------------------------------------------------ |
> | 50%| 50.5|
> | 90%| 10.9|
> | 99.90%| 1.1|

<img src="images/2023-06-26-15-12-20.png" width=350 />

### Data Transferred from HDD

$$
\text{Disk Access Time} = \text{Seek Time} + \text{Rotational Time} + \cfrac{\text{Transfer Length}}{\text{Bandwidth}}
$$

Effective disk buffer access time: $\text{EA} = \text{HB} \times \text{BC} + (1-HB)\times \text{D}$
where:

- $\text{HB}$ is the hit ratio of the buffer,
- $\text{BC}$ is the buffer access time and
- $\text{D}$ is the disk access time.

> Example
> | Hit Ratio | Effective Access Time as Multiple of C, M = 1000 C |
> | --------- | ------------------------------------------------- |
> | 50% | 500.5 |
> | 99.00% | 100.9 |
> | 99.90% | 1.999 |
> | 99.99% | 1.0999 |

## Communication Costs

$$
\text{Transimit Time} = \text{Distance/c} + (\text{Message Bits}/\text{Bandwidth})
$$

$c = \text{Speed of Light (200 million meters/sec) with fibre optics}$

This means we can no longer reduce latency on contemporary hardware further and increasingly the motto is that the message length should be large to achieve a better utilization.

## Multi-Core System

<img src="images/2023-06-26-15-10-12.png" width=250/>

Each core has its own L1 cache and L2 cache. L3 cache is shared among all cores.

<img src="images/2023-06-26-15-10-36.png" width=350/>

> **Recall Memory Hierachy**
> Processor $\rightarrow$ Register $\rightarrow$ Cache (level 1, 2, 3) $\rightarrow$ Main Memory $\rightarrow$ Hard Disk Drive
>
> - The larger the memory, the slower it is.
> - The smaller the memory, the faster it is and more expensive it is.

## Types of Database Systems

### Simple File System

Simple file system as a plain text file. Each line holds one record, with fields separated by delimiter (e.g., commas or tabs).

- Usually ver fast for simple applications but can be slow for complex applications.
- It can be less reliable than other systems.
- Application dependent optimisation, e.g., indexing.
- Very hard to main them (concurrency problems).
- Many of the required features (that exist in the relational databases) need to be incorporated - unnecessary code development and potential increase in unreliability.

### RDBS (Relational Database System)

<img src="images/2023-06-26-21-20-38.png" width=350 />

RDBS as a collection of tables (relations) consisting of rows and column. A primary key is used to uniquely identify each row.

- Very reliable (consistency of data)
- Application independent optimisation (query optimisation)
- Well suited to many applications, very fast due to large main memory machines and SSDs
- Some RBD also support Object Oriented model, e.g. Oracle, DB2 and XML data with queries
- RDBS can be slow for some simple applications

### Object-Oriented Database System

Data stored in the form of 'objects' directly (like Object-oriented programming).

- It stores data as objects directly, not tables
- May contian both data (attributes) and methods like OOP
- Can be slow on some applications, e.g., complex queries
- Reliable
- Limited application independent optimisation
- Well suited for applications requiring complex data
- Unfortunately, many commercial systems started did not survive the force of RDB technology and basically disappeared from the market

### NoSQL Database System

Non relational - database modelled other than the tabular relations. Covers a wide range of database types.

- Flexible/no fixed data schema (unlike RDB)
- Provides a mechanism for storage and retrieval of data modelled in means other than the tabular relations
- Simple design, should linear scale
- NoSQL has compromise consistency and allows replications
- Most NoSQL databases offer "eventual consistency", which might result in reading data from an older version, a problem known as stale reads

#### Types of NoSQL Database

##### Key-value store: Tokyo Cabinet, Redis, Voldemort, Oracle NoSQL Database, Amazon DynamoDB, Riak, Apache Cassandra, etc.

Key-value pair database systems store data as a collection of key-value pairs, where each key is unique.

> **Why useful**: Many applications do not require the expressive functionality of transaction processing - e.g. Web Search, Big Data Analytics can use MapReduce technology.

- Can be seen as a type of NoSQL database
- Used for building very fast, highly parallel processing of large data - MapReduce and Hadoop are examples
- Atomic updates at Key-value pair level (row update) only

##### Document-Based: MongoDB, CouchDB, OrientDB, RavenDB, etc.

##### Column-Based: BigTable, Apache Cassandra, HBase, Hypertable, etc.

##### Graph-Based: Neo4J, InfiniteGraph, Flock DB, etc.

##### Some other DB systems - Deductive database systems (DDBS)

DDBS is a database system that can make deductions (i.e., conclude additional facts) based on rules and facts stored in the database.

- It allows recursion
- Most of the application can be developed entirely using DDBS
- There are no commercially available systems like RDBs
- Many applications do not require the expensive power of these systems (e.g. many commerce related applications)
- Many RDBs do provide some of the functionality - e.g. supporting transitive closure operation (a form of recursion in SQL2). For example $\text{path(X,Y)}:-\text{edge(X,Y)}$ and $\text{path(X,Y)}:-\text{edge(X,Z), path(Z,Y)}$.

---

| Database Type                     | Description                                                                                                                  | Advantage                                  | Disadvantage                                                                                                                                | Example                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Simple File System                | Plain text file, each line holds one record, with fields separated by delimiter (e.g., commas or tabs)                       | Very fast for simple applications          | Can be slow for complex applications                                                                                                        |                                                                  |
| RDBS                              | Collection of tables (relations) consisting of rows and column. A primary key is used to uniquely identify each row          | Very reliable (consistency of data)        | Can be slow for some simple applications                                                                                                    | Oracle, MySQL, Microsoft SQL Server, PostgreSQL, etc.            |
| Object-Oriented Database System   | Data stored in the form of 'objects' directly (like Object-oriented programming)                                             | Reliable                                   | Can be slow on some applications, e.g., complex queries                                                                                     | ObjectStore, Objectivity/DB, ZODB, etc.                          |
| NoSQL Database System             | Non relational - database modelled other than the tabular relations. Covers a wide range of database types                   | Flexible/no fixed data schema (unlike RDB) | Most NoSQL databases offer "eventual consistency", which might result in reading data from an older version, a problem known as stale reads | Key-value store, Document-Based, Column-Based, Graph-Based, etc. |
| Deductive database systems (DDBS) | A database system that can make deductions (i.e., conclude additional facts) based on rules and facts stored in the database | It allows recursion                        | Many RDBs do provide some of the functionality                                                                                              |                                                                  |

## Database Architecture

![](images/2023-06-26-17-40-35.png)

### Centralised

<img src="images/2023-06-26-17-30-00.png" width=350 />

Data stored in one location. All users access the same data.

- Data in one location
- System administration is simple
- Optimisation process is generally very effective
- PC/Cluster Computing/data centres are examples of this architecture

<img src="images/2023-06-26-17-31-07.png" width=350 />

Client-server architecture that uses a centralised database server.

- A central server with a central DB in one location. But client and server can be in different location.
- Client generally provides user interfaces for input and output.
- Server provides all the necessary database functionality.
- System administration is relatively simple.
- System recovery is similar to centralised systems.

### Distributed

<img src="images/2023-06-26-17-32-29.png" width=350 />

Data distributed across several nodes, can be in different locations. Users access data from their local node.

- Data is distributed across several nodes in different locations
- Nodes are connected by network
- System provides concurrency, recovery and transaction processing
- System administration is complex, usually with a single resource manager
- Crash recovery is complicated
- There are usually data replication and data fragmentation -> potential for data inconsistency

### WWW

<img src="images/2023-06-26-17-33-51.png" width=350 />

Stored all over the world, several owners of the data.

- Data is stored in many locations
- Several owners of data - no certainty of data availability or consistency
- Optimisation process is generally very ineffective
- Evolving database technology - no standards have been developed except in case of XML/http and some protocols for accessing data
- Security could be a potential problem
- Notions of Transactions is much more difficult to enforce

### Grid

Like distributed database, but each node manaes own resources. System doesn't act as a single unit.

- Very similar to distributed database system
- Data and processing are shared among a group of computer systems which many geographically separated
- Usually designed for particular purpose, e.g. scientific applications
- **Administration of such systems are doen locally by each owner of the system**
- Reliability and security of such systems are not well developed or studied
- Grid systems model is more or less outdated by Cloud Computing model

### P2P

Like grid database, but nodes can join and leave network at will (unlike grid).

- Data and processing is shared among a group of computer systems which may be geographically separated as in Grid Database Systems
- **Computer nodes can join and leave the network at will unlike in grid database, as a result, it is harder to design transaction model**
- Usually designed for particular purpose, e.g. scientific applications
- Administration of such systems are doen by the owners of the data

### Cloud

> Cloud Computing: https://www.youtube.com/watch?v=dH0yz-Osy54

Generalisation of grid, but resources are accessed on-demand.

Cloud computing offers online computing, storage and a range of new services for data and devices that are accessible through the Internet. User pays for the services just like phone services, electricity, etc. Huge potential for developing applications with minimal infrastructure costs.

Cloud services offered in several forms:

- IaaS: Infrastructure as a Service (provide virtual machines)
- PaaS: Platform as a Service (provide development platform)
- SaaS: Software as a Service (provide software)

## Fault Tolerance

The property that enables a system to continue operating properly in the event of the failure of some of its components.

## A system's lifecycle

![](images/2023-06-26-18-11-44.png)

Module availability: measures the ratio of service accomplishment to elapsed time: $\cfrac{\text{Mean time to failure}}{\text{Mean time to failure + Mean time to repair}}$, where _Mean time to failure_ is the time elapsing before a failure is experienced.

- $\text{Mean time to failure} = 1 / \text{Failure Rate}$
- $\text{Mean time to repair} = 1 / \text{Repair Rate}$

## Fault tolerance by RAID

RAID is a storage technology that combines multiple disk drive components into a logical unit for the purposes of data redundancy and performance improvement.

Redundant Array of Independent Disks (RAID) - different ways to combine multiple disks as a unit for **fault tolerance** or _performance improvement_, or both of a database system.

Bits (b), Bytes (B), Blocks (4K or 8K bytes of storage)

- e.g. we have data 1010 1100 1011 1100
- bit: 1 0 1 0 1 1 0 0 1 0 1 1 1 0 0 0
- bytes: **1010 1100** 1011 1100, bytes are 8 bits

### RAID o (Block Level Stripping)

![](images/2023-06-26-18-15-55.png)

A0, A1, A2, ... are contiguous blocks of data of a file.

- Provides balanced I/O of disk drives - throughput ~ doubles
- Any disk failure will be catastrophic and MTTF reduces by a factor of 2
- > Higher throughput at the cost of increased vulnerability to failures

> A means Block (4K or 8K bytes of storage)
> MTTF = Mean Time To Failure

Example:

- If we have 3 disks, assume we need to write 4 blocks of data. Then data will write to disk 1, 2, 3, 1, 2, 3, 1, 2, 3, 1, 2, 3, ... (circularly).

### RAID 1 (mirroing)

![](images/2023-06-26-18-32-22.png)

### RAID 2 (Bit level Striping)

![](images/2023-06-26-18-32-32.png)

### RAID 3 (Byte level Striping)

![](images/2023-06-26-18-32-46.png)

### RAID 4 (Block level level striping)

![](images/2023-06-26-18-32-57.png)

### RAID 5 with 3 disks (Block level striping)

![](images/2023-06-26-18-33-05.png)

### RAID 6 (Block level level striping)

![](images/2023-06-26-18-33-54.png)

## Fault Tolerance by Voting

> Use more than one module, voting for higher reliability

![](images/2023-06-26-18-20-12.png)

- Failvote: stops if there are no majority agreement
- Failfast (voting): similar to failvote except the system senses which modules are available and uses the majority of the available modules
- Failsoft: similar to failfast except the system uses all the available modules
  - A 10 module Failfast system continues to operate until the failure of 9 modules where as Failvote stops when 5 modules fail
  - Failfast system has better availability than failvoting (since failvote steops when there is no majority agreement)

Failvote needs majority agreement to accept an action (e.g. Read/Write)

![](images/2023-06-26-18-20-50.png)

If we start with 10 devices, the system works as long as 6 of them are working. Action is accepted when 6 or more agreeing on the decision.

The moment 5th one fails, system stops as there cannot be 6 devices agreeing on the decision.

In Failfast, we are only concerned of majority among the working ones. We are assuming that we can tell which ones are working. Hence we can continue to operate until 2 working ones and if both agree we can proceed with the action. But if they different the system stops.

![](images/2023-06-26-18-22-35.png)

### Fault Tolerance for disks

Supermodel - Natually, a system with multiple hard disk drives is expected to function with only one working disk (use voting when multiple disks are working/available, but still work even when only one is available)

## Availability of Failvote systems

> If there are n events, mean time to the first event = m / n

Consider a system with modules with MTTF of 10 years.

- Failvoting with 2 devices: MTTF = 10/2 = 5 years (system fails with 1 device failure)
- Failvoting with 3 devices: MTTF = 10/3 for the first failure + 10/2 for 2nd failure = 8.3 years

> Lower availability for higher reliability (multiple modules agreeing on a value means that value is more likely to be accuracte/reliable)

## Fault Tolerance with Repair

With repair of modules: the fault equipment is reparied with an average time of MTTR (Mean Time to Repair) as soon as a fault is detected (sometime MTTR is just time needed to replace).

Typical values for recent disks:

- MTTR = Few hours (assuming we stock spare disks) to 1 Day
- MTTF = 750,000 hours (85 years) [hard fault]

Probability of a particular module is not available = $\cfrac{\text{MTTR}}{\text{MTTF + MTTR}} \approxeq \cfrac{\text{MTTR}}{\text{MTTF}}$ if MTTF >> MTTR.

## Fault Tolerance with Supermodule

Probability that (n-1) modules are unavailable, $P_{n-1} = \cfrac{\text{MTTR}}{\text{MTTF}}^{n-1}$

Probability that a particular $i^{\text{th}}$ moduel fails, $P_i = \cfrac{i}{\text{MTTF}}$

Probability that the system fails with a particular $i^{\text{th}}$ module failing last = $P_f\times P_{n-1} = \cfrac{i}{\text{MTTF}}\cfrac{\text{MTTR}}{\text{MTTF}}^{n-1}$

Probability that a supermodule fails due to any one of the n modules failing last, when other (n-1) modules are unavailable = $\cfrac{n}{\text{MTTF}}\cfrac{\text{MTTR}}{\text{MTTF}}^{n-1}$

## Transaction Models

Disk writes for consistency: Either entire block is written correctly on disk or the contents of the block is unchanged. To achieve disk write consistency, we can do:

### Duplex Write

- Each block of data is written in two places sequentially
- If one of the writes fail, system can issue another write
- Each block is associated with a version number. The block with the latest version number contains the most recent data
- > While reading - we can determine error of a disk block by its CRC
- It always guarantees at least one block has consistent data

### Logged Write

Similar to duplex write, except one of the writes goes to a log. This method is very efficient if the changes to a block are small.

## Cyclic Redeundancy Check (CRC) Generation

Cyclic Redundancy Check (CRC) is a technique used to detect errors in digital data. It involves the use of a generator polynomial. The choice of the polynomial is beyond the data that is being sent; it is determined by the protocol agreed upon by the sending and receiving parties. Different polynomials will catch different error patterns.

CRC involves binary division of the data units by the generator polynomial. The remainder of this division is appended to the end of the data unit and sent to the receiver. At the receiver end, the same division is performed, if there's no remainder, the data is assumed to be intact, if there's a remainder, an error is detected

$\text{CRC polynomial } x^{32} + x^{23} = x^7 + 1$

Most errors in communicatoins or on disk happen contiguously, that is in burst in nature. The above CRC generator can detect all burst errors with a length less than or equal to 32 bits; 5 out of 10 billion burst errors with length 33 will be undetected; 3 out of 10 billion burst errors of length 34 or more will be undetected.

Example of CRC polynomials:

- $x^5 + x^3 + 1$ $\rightarrow$ five bits long due to the five xors
- $x^{15} + x^{14} + x^{11} + x^{10} + x^{8} + x^{7} + x^{4} + x^{3} + 1$ $\rightarrow$ 15 bits long 1110 0001 1001 1001

### How to determine the CRC polynomial

The CRC polynomial is chosen to maximize the error detection capability, but it is also chosen to be easy to implement in hardware. The CRC polynomial is chosen to be a prime number.

---

> Data 101011
> CRC polynomial $1 \times x^3 + 0 \times x^2 + 1 \times x + 1$
>
> 1. Add 3 zeros to the right of the data
> 2. Divide the data by the polynomial use XOR (exclusive OR) operation

To compute an _n_-bit binary CRC:

1. Add n zero bits as 'paddint' to the right of the input bits

> Input: 11010011101100
> This is first padded with zeros corresponding to the bit length $n$ of the CRC:
> 11010011101100 _000_ $\leftarrow$ input left shifted by 3 bits of padding.

2. Compute the _$(n+1)$_-bit pattern representing the CRC's divisor (called a polynomial)

> In the following example, we shall encode 14 bits of message with a 3-bit CRC, with a polynomial $x^3 + x + 1$. The polynomial is written in binary as the coefficients; a 3rd-degree polynomial has 4 coefficients ($1x^3 + 0x^2 + 1x + 1$). In this case, the coefficients are 1, 0, 1 and 1.

3. Position the _$(n+1)$_-bit pattern representing the CRC's divisor underneath the left-hand end of the input bits

> 11010011101100 000 $\leftarrow$ input right padded by 3 bits
> 1011 $\leftarrow$ divisor (4 bits) or CRC polynomial $x^3 + x + 1$

4. The algorithm acts on the bits directly above the divisor in each step

> - The result for each iteration is the bitwise XOR of the polynomical divisor with bits above it.
> - The bits not above the divisor are simply copied direcly below for that step.
> - The divisor is then shifted one bit to the right (or moves over to align with the next 1 in the dividend), and the process is repeated until the bits of the input message becomes zero.

![](images/2023-06-26-18-08-31.png)

### Checking validity with CRC

The validity of a received message can easily be verified by performing the above calculation again, this time with the check value added instead of zeros. The remainder should equal zero if there are no detectable errors.

![](images/2023-06-27-09-41-58.png)
